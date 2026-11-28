package worker

import (
	"context"
	"html/template"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/openmentor-io/openmentor/api/pkg/analytics"
	"github.com/openmentor-io/openmentor/api/pkg/email"
	"github.com/openmentor-io/openmentor/api/pkg/logger"
	"github.com/openmentor-io/openmentor/api/pkg/redact"
	"github.com/openmentor-io/openmentor/api/pkg/reviewtoken"
)

// defaultDeclineReasonText mirrors DEFAULT_DECLINE_REASON_TEXT in the func's
// SessionDeclinedMessage.
const defaultDeclineReasonText = "Возможно, у ментора сейчас нет времени или подходящего опыта по этой теме."

// RequestProcessFinished ports openmentor-func/request-process-finished/index.ts:
// notify the mentee after the mentor finalized a request. Status 'done'
// sends session-complete, 'declined' sends session-declined (with the
// decline reason mapping from P2.6); any other status is a tracked no-op.
func (h *Handlers) RequestProcessFinished(c *gin.Context) {
	ctx := c.Request.Context()
	const job = "request-process-finished"

	requestID := c.Query("requestId")
	if requestID == "" {
		h.track(ctx, analytics.EventRequestProcessFinishedNotified, analytics.SystemDistinctID("worker"), map[string]interface{}{
			"outcome": "missing_request_id",
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": "requestId is required"})
		return
	}

	request, err := h.repo.GetJobRequestWithMentorName(ctx, requestID)
	if err != nil {
		logger.Error("[Request Process Finished] Failed to fetch request", zap.String("request_ref", redact.ID(requestID)), logger.RedactedError(err))
		h.track(ctx, analytics.EventRequestProcessFinishedNotified, analytics.SystemDistinctID("worker"), map[string]interface{}{
			"outcome":    "error",
			"error_type": errTypeDBError,
		})
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Internal error"})
		return
	}
	if request == nil {
		logger.Warn("[Request Process Finished] Request not found", zap.String("request_ref", redact.ID(requestID)))
		h.track(ctx, analytics.EventRequestProcessFinishedNotified, analytics.SystemDistinctID("worker"), map[string]interface{}{
			"outcome": "request_not_found",
		})
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	// A decline retry must never dispatch the separate completed-session flow
	// if the status changed since the retry listing.
	if ctx.Value(declineRetryKey{}) != nil && request.Status != mentorStatusDeclined {
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}

	var message *email.Message
	switch request.Status {
	case "done":
		reviewURL, mintErr := h.issueReviewInvitation(ctx, request.ID)
		if mintErr != nil {
			logger.Error("[Request Process Finished] Failed to issue review invitation",
				zap.String("request_ref", redact.ID(request.ID)), logger.RedactedError(mintErr))
			h.track(ctx, analytics.EventRequestProcessFinishedNotified, analytics.MentorDistinctID(request.MentorID), map[string]interface{}{
				"mentor_id":  request.MentorID,
				"outcome":    "error",
				"error_type": errTypeDBError,
			})
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Internal error"})
			return
		}
		message = &email.Message{
			TemplateName: "session-complete",
			Recipient:    request.Email,
			Props: map[string]interface{}{
				"first_name":  request.Name,
				"mentor_name": request.MentorName,
				"review_url":  reviewURL,
			},
		}
	case mentorStatusDeclined:
		message = &email.Message{
			TemplateName: "session-declined",
			Recipient:    request.Email,
			Props: map[string]interface{}{
				"first_name":        request.Name,
				"mentor_name":       request.MentorName,
				"decline_info":      buildDeclineInfoHTML(request.DeclineReason, request.DeclineComment),
				"decline_info_text": buildDeclineInfoText(request.DeclineReason, request.DeclineComment),
			},
		}
	default:
		h.track(ctx, analytics.EventRequestProcessFinishedNotified, analytics.MentorDistinctID(request.MentorID), map[string]interface{}{
			"mentor_id": request.MentorID,
			"status":    request.Status,
			"outcome":   "status_not_actionable",
		})
		c.JSON(http.StatusOK, gin.H{"success": true, "requestId": requestID})
		return
	}

	var sendErr error
	if request.Status == mentorStatusDeclined {
		_, sendErr = h.sendRequestDelivery(ctx, request.ID, "decline", job, *message)
	} else {
		sendErr = h.sendEmail(ctx, job, *message)
	}
	if sendErr != nil {
		h.track(ctx, analytics.EventRequestProcessFinishedNotified, analytics.MentorDistinctID(request.MentorID), map[string]interface{}{
			"mentor_id":  request.MentorID,
			"outcome":    "error",
			"error_type": errTypeEmailSendFailed,
		})
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Internal error"})
		return
	}

	logger.Info("[Request Process Finished] Notification sent",
		zap.String("request_ref", redact.ID(request.ID)),
		zap.String("status", request.Status),
	)
	h.track(ctx, analytics.EventRequestProcessFinishedNotified, analytics.MentorDistinctID(request.MentorID), map[string]interface{}{
		"mentor_id": request.MentorID,
		"status":    request.Status,
		"outcome":   "success",
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "requestId": requestID})
}

// ReviewTokenFragmentKey is the URL-fragment parameter the review page reads the
// capability out of. Kept exported so the sentinel tests and the web contract
// have one spelling to agree on.
const ReviewTokenFragmentKey = "review_token"

// issueReviewInvitation mints a review capability, stores its hash, and returns
// the link to mail (H4).
//
// The token rides in the URL **fragment**, not the path and not the query, and
// that is the whole point: a fragment is never transmitted to a server, so it
// cannot land in Traefik's access log, in otelgin's url.path/url.query, in a
// Referer header, or in PostHog's $current_url — which is exactly where the old
// ?request_id= ended up (12 uuids, 93 events, 21 sessions, 15 replays). The
// review page reads window.location.hash and clears it before analytics
// initializes, and web/src/lib/redact.ts scrubs the fragment from telemetry
// strings as a second line of defense.
//
// Storing precedes mailing: a token whose hash was not committed is a link that
// can never be spent.
func (h *Handlers) issueReviewInvitation(ctx context.Context, requestID string) (string, error) {
	raw, hash, err := reviewtoken.New()
	if err != nil {
		return "", err
	}
	if storeErr := h.repo.CreateReviewInvitation(ctx, requestID, hash, time.Now().Add(reviewtoken.TTL)); storeErr != nil {
		return "", storeErr
	}
	// base64url needs no escaping, but escape anyway so a future encoding change
	// cannot silently produce a broken link.
	return h.baseURL + "/reviews/new#" + ReviewTokenFragmentKey + "=" + url.QueryEscape(raw), nil
}

// mapDeclineReason mirrors SessionDeclinedMessage.mapDeclineReason (P2.6):
// known decline reason codes map to friendly copy; unknown codes pass through.
func mapDeclineReason(reason string) string {
	switch reason {
	case "no_time":
		return "Сейчас нет времени"
	case "topic_mismatch":
		return "Тема не соответствует опыту"
	case "helping_others":
		return "Уже помогает другим участникам"
	case "on_break":
		return "Перерыв в менторстве"
	case "other":
		return "Другое"
	default:
		return reason
	}
}

// declineInfo carries the two optional rows of the decline_info fragment.
// An absent row is the empty string, which is what {{with}} skips on.
type declineInfo struct {
	Reason  string
	Comment string
}

// declineInfoTpl reproduces the markup of
// SessionDeclinedMessage.buildDeclineInfoHtml.
var declineInfoTpl = template.Must(template.New("declineInfo").Parse(
	`<br><br>` +
		`{{with .Reason}}<div style="font-family: inherit; text-align: inherit"><strong>Причина:</strong> {{.}}<br></div>{{end}}` +
		`{{with .Comment}}<div style="font-family: inherit; text-align: inherit"><strong>Комментарий:</strong> {{.}}</div>{{end}}`))

// buildDeclineInfoHTML mirrors SessionDeclinedMessage.buildDeclineInfoHtml.
// The result is template.HTML because the session-declined template
// interpolates decline_info as markup; the mentor's free-text comment inside
// it is escaped by declineInfoTpl.
func buildDeclineInfoHTML(reason, comment string) template.HTML {
	info := declineInfo{}
	if strings.TrimSpace(reason) != "" {
		info.Reason = mapDeclineReason(reason)
	}
	if strings.TrimSpace(comment) != "" {
		info.Comment = comment
	}

	if info.Reason == "" && info.Comment == "" {
		return defaultDeclineReasonText
	}
	return renderFragment(declineInfoTpl, info)
}

// buildDeclineInfoText mirrors SessionDeclinedMessage.buildDeclineInfoText.
func buildDeclineInfoText(reason, comment string) string {
	hasReason := strings.TrimSpace(reason) != ""
	hasComment := strings.TrimSpace(comment) != ""

	if !hasReason && !hasComment {
		return defaultDeclineReasonText
	}

	var b strings.Builder
	b.WriteString("\n\n")
	if hasReason {
		b.WriteString("Причина: ")
		b.WriteString(mapDeclineReason(reason))
		b.WriteString("\n")
	}
	if hasComment {
		b.WriteString("Комментарий: ")
		b.WriteString(comment)
	}
	return b.String()
}
