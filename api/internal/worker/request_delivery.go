package worker

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/openmentor-io/openmentor/api/pkg/email"
)

type requestDeliveryRepository interface {
	ClaimRequestDelivery(context.Context, string, string) (string, error)
	FinishRequestDelivery(context.Context, string, string, string, bool) (bool, error)
	ListRequestDeliveries(context.Context) ([]deliveryItem, error)
	DeferRequestDelivery(context.Context, string, string) error
}
type deliveryItem struct{ ID, Kind string }

// Claim tokens fence stale workers. The provider may have accepted a message even
// when Send returns an error or the process dies: retries can therefore duplicate.
func (r *Repository) ClaimRequestDelivery(ctx context.Context, id, kind string) (string, error) {
	var token string
	err := r.pool.QueryRow(ctx, `UPDATE request_deliveries d SET claim_token=gen_random_uuid(),claimed_at=clock_timestamp() FROM client_requests c
 WHERE d.request_id=$1 AND d.kind=$2 AND c.id=d.request_id AND d.sent_at IS NULL
 AND (d.claimed_at IS NULL OR d.claimed_at < clock_timestamp()-interval '3 minutes')
 AND ((d.kind='decline' AND c.status='declined') OR (d.kind='mentor' AND c.status='pending') OR (d.kind IN ('mentee','moderator') AND c.status IN ('pending','contacted','working','declined','done','unavailable')))
 RETURNING d.claim_token::text`, id, kind).Scan(&token)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return token, err
}
func (r *Repository) FinishRequestDelivery(ctx context.Context, id, kind, token string, success bool) (bool, error) {
	tag, err := r.pool.Exec(ctx, `UPDATE request_deliveries SET sent_at=CASE WHEN $4 THEN clock_timestamp() ELSE NULL END, claim_token=NULL, claimed_at=NULL, next_attempt_at=clock_timestamp()+interval '10 minutes' WHERE request_id=$1 AND kind=$2 AND claim_token=$3::uuid AND sent_at IS NULL`, id, kind, token, success)
	return tag.RowsAffected() == 1, err
}
func (r *Repository) ListRequestDeliveries(ctx context.Context) ([]deliveryItem, error) {
	rows, err := r.pool.Query(ctx, `SELECT d.request_id::text, CASE WHEN d.kind='decline' THEN 'decline' ELSE 'initial' END AS group_kind FROM request_deliveries d JOIN client_requests c ON c.id=d.request_id WHERE d.sent_at IS NULL AND d.next_attempt_at<=now() AND (d.claimed_at IS NULL OR d.claimed_at<now()-interval '3 minutes') AND ((d.kind='decline' AND c.status='declined') OR (d.kind='mentor' AND c.status='pending') OR (d.kind IN ('mentee','moderator') AND c.status IN ('pending','contacted','working','declined','done','unavailable'))) GROUP BY d.request_id, group_kind ORDER BY min(d.next_attempt_at), d.request_id LIMIT 50`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []deliveryItem
	for rows.Next() {
		var item deliveryItem
		if err := rows.Scan(&item.ID, &item.Kind); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
func (r *Repository) DeferRequestDelivery(ctx context.Context, id, kind string) error {
	_, err := r.pool.Exec(ctx, `UPDATE request_deliveries SET next_attempt_at=now()+interval '10 minutes' WHERE request_id=$1 AND sent_at IS NULL AND (($2='decline' AND kind='decline') OR ($2='initial' AND kind<>'decline'))`, id, kind)
	return err
}
func (h *Handlers) sendRequestDelivery(ctx context.Context, id, kind, job string, msg email.Message) (bool, error) {
	repo, ok := h.repo.(requestDeliveryRepository)
	if !ok {
		return false, errors.New("request delivery repository unavailable")
	}
	token, err := repo.ClaimRequestDelivery(ctx, id, kind)
	if err != nil || token == "" {
		return false, err
	}
	sendCtx, cancel := context.WithTimeout(ctx, time.Minute)
	err = h.sendEmail(sendCtx, job, msg)
	cancel()
	finishCtx, finishCancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
	defer finishCancel()
	applied, finishErr := repo.FinishRequestDelivery(finishCtx, id, kind, token, err == nil)
	if finishErr != nil {
		return false, finishErr
	}
	if !applied {
		return false, errors.New("request delivery claim lost")
	}
	return err == nil, err
}

// A bounded sweep recovers dropped callbacks and failed sends. Per-recipient
// claims also coordinate it with callbacks and other worker processes.
func (h *Handlers) RetryRequestDeliveries(ctx context.Context) (JobSummary, error) {
	summary := JobSummary{Job: "retry-request-deliveries"}
	if h.skipRequestRetry() {
		summary.Skipped = true
		summary.SkipReason = skipReasonNonProduction
		return summary, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	repo, ok := h.repo.(requestDeliveryRepository)
	if !ok {
		return summary, errors.New("request delivery repository unavailable")
	}
	items, err := repo.ListRequestDeliveries(ctx)
	if err != nil {
		return summary, err
	}
	summary.MentorsMatched = len(items)
	for _, item := range items {
		if ctx.Err() != nil {
			return summary, ctx.Err()
		}
		if err := repo.DeferRequestDelivery(ctx, item.ID, item.Kind); err != nil {
			return summary, err
		}
		path := "/jobs/new-request-watcher?requestId=" + url.QueryEscape(item.ID)
		method := http.MethodPost
		if item.Kind == moderationActionDecline {
			path = "/jobs/request-process-finished?requestId=" + url.QueryEscape(item.ID)
			method = http.MethodGet
		}
		rec := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(rec)
		c.Request = httptest.NewRequest(method, path, http.NoBody).WithContext(ctx)
		if item.Kind == moderationActionDecline {
			c.Request = c.Request.WithContext(context.WithValue(ctx, declineRetryKey{}, true))
			h.RequestProcessFinished(c)
		} else {
			h.NewRequestWatcher(c)
		}
		if rec.Code >= 400 {
			summary.EmailFailures++
		}
	}
	if summary.EmailFailures > 0 {
		return summary, errors.New("request delivery retry groups failed")
	}
	return summary, nil
}

type declineRetryKey struct{}
