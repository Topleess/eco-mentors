package worker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openmentor-io/openmentor/api/config"
	"github.com/stretchr/testify/require"
)

func TestDeliveryRetryNonProductionRequiresOverride(t *testing.T) {
	r := deliveryTestRepository(t)
	mentor := insertMentor(t, r, "safety-"+uuid.NewString(), mentorStatusActive)
	insertClientRequest(t, r, mentor)
	sender := &fakeEmailSender{}
	h := NewHandlers(r, sender, nil, &config.Config{})
	summary, err := h.RetryRequestDeliveries(context.Background())
	require.NoError(t, err)
	require.True(t, summary.Skipped)
	require.Empty(t, sender.attempts)
}

func TestDeliveryRetryPreservesInitialObligationsAfterDecline(t *testing.T) {
	r := deliveryTestRepository(t)
	ctx := context.Background()
	mentor := insertMentor(t, r, "transition-"+uuid.NewString(), mentorStatusActive)
	id := insertClientRequest(t, r, mentor)
	_, err := r.pool.Exec(ctx, `UPDATE client_requests SET status='declined' WHERE id=$1`, id)
	require.NoError(t, err)
	sender := &fakeEmailSender{}
	cfg := &config.Config{}
	cfg.Server.AppEnv = "production"
	h := NewHandlers(r, sender, nil, cfg)
	_, err = h.RetryRequestDeliveries(ctx)
	require.NoError(t, err)
	names := make([]string, 0, len(sender.attempts))
	for _, m := range sender.attempts {
		names = append(names, m.TemplateName)
	}
	require.Contains(t, names, "new-request")
	require.Contains(t, names, "new-request-moderator")
	require.NotContains(t, names, "new-request-mentor")
	require.Contains(t, names, "session-declined")
}

func TestDeliveryRetryReportsFailure(t *testing.T) {
	r := deliveryTestRepository(t)
	mentor := insertMentor(t, r, "failure-"+uuid.NewString(), mentorStatusActive)
	insertClientRequest(t, r, mentor)
	sender := &fakeEmailSender{failTemplates: map[string]bool{"new-request": true}}
	cfg := &config.Config{}
	cfg.Server.AppEnv = "production"
	h := NewHandlers(r, sender, nil, cfg)
	summary, err := h.RetryRequestDeliveries(context.Background())
	require.Error(t, err)
	require.Equal(t, 1, summary.EmailFailures)
}

// Production routing is safe here because every test injects fakeEmailSender.
func productionRetryTestConfig() *config.Config {
	cfg := &config.Config{}
	cfg.Server.AppEnv = "production"
	return cfg
}

func TestAcceptanceRetrySafetyAndFailure(t *testing.T) {
	r := deliveryTestRepository(t)
	ctx := context.Background()
	mentor := insertMentor(t, r, "accept-safety-"+uuid.NewString(), mentorStatusActive)
	id := insertClientRequest(t, r, mentor)
	_, err := r.pool.Exec(ctx, `UPDATE client_requests SET accepted_at=now(),accepted_contact='test@example.test' WHERE id=$1`, id)
	require.NoError(t, err)
	sender := &fakeEmailSender{failAll: true}
	h := NewHandlers(r, sender, nil, &config.Config{})
	summary, err := h.RetryAcceptanceNotifications(ctx)
	require.NoError(t, err)
	require.True(t, summary.Skipped)
	require.Empty(t, sender.attempts)
	h.appEnv = "production"
	summary, err = h.RetryAcceptanceNotifications(ctx)
	require.Error(t, err)
	require.Equal(t, 1, summary.EmailFailures)
}

func TestDeliveryMigrationDoesNotBackfillHistoricalRequests(t *testing.T) {
	r := deliveryTestRepository(t)
	ctx := context.Background()
	mentor := insertMentor(t, r, "history-"+uuid.NewString(), mentorStatusActive)
	tx, err := r.pool.Begin(ctx)
	require.NoError(t, err)
	defer tx.Rollback(ctx)
	down, err := os.ReadFile("../../migrations/000029_request_delivery.down.sql")
	require.NoError(t, err)
	up, err := os.ReadFile("../../migrations/000029_request_delivery.up.sql")
	require.NoError(t, err)
	_, err = tx.Exec(ctx, string(down))
	require.NoError(t, err)
	var id string
	err = tx.QueryRow(ctx, `INSERT INTO client_requests(mentor_id,email,name,status) VALUES ($1,'historic@example.test','Historical','pending') RETURNING id`, mentor).Scan(&id)
	require.NoError(t, err)
	_, err = tx.Exec(ctx, string(up))
	require.NoError(t, err)
	var count int
	err = tx.QueryRow(ctx, `SELECT count(*) FROM request_deliveries WHERE request_id=$1`, id).Scan(&count)
	require.NoError(t, err)
	require.Zero(t, count)
}

func TestInitialObligationsSurviveContactedStatus(t *testing.T) {
	r := deliveryTestRepository(t)
	ctx := context.Background()
	mentor := insertMentor(t, r, "contacted-"+uuid.NewString(), mentorStatusActive)
	id := insertClientRequest(t, r, mentor)
	_, err := r.pool.Exec(ctx, `UPDATE client_requests SET status='contacted' WHERE id=$1`, id)
	require.NoError(t, err)
	token, err := r.ClaimRequestDelivery(ctx, id, "mentee")
	require.NoError(t, err)
	require.NotEmpty(t, token)
}

func TestDeclineRetryDoesNotSendCompletedSession(t *testing.T) {
	env := newJobsTestEnv()
	env.repo.requestsWithMentor[finishedRequestID] = finishedRequest("done")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/jobs/request-process-finished?requestId="+finishedRequestID, http.NoBody).WithContext(context.WithValue(context.Background(), declineRetryKey{}, true))
	env.handlers.RequestProcessFinished(c)
	require.Equal(t, http.StatusOK, w.Code)
	require.Empty(t, env.sender.attempts)
}
