package worker

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openmentor-io/openmentor/api/config"
	"github.com/openmentor-io/openmentor/api/internal/models"
	"github.com/openmentor-io/openmentor/api/internal/repository"
	"github.com/openmentor-io/openmentor/api/internal/services"
	"github.com/stretchr/testify/require"
)

type completedTriggerBody struct {
	io.Reader
	done chan struct{}
}

func (b *completedTriggerBody) Close() error { close(b.done); return nil }

type completedTriggerClient struct{ done chan struct{} }

func (c completedTriggerClient) Get(string) (*http.Response, error) { return c.Do(nil) }
func (c completedTriggerClient) Post(string, string, io.Reader) (*http.Response, error) {
	return c.Do(nil)
}
func (c completedTriggerClient) Do(*http.Request) (*http.Response, error) {
	return &http.Response{StatusCode: 503, Body: &completedTriggerBody{Reader: strings.NewReader(""), done: c.done}}, nil
}

func TestIsolatedRequestAcceptanceAndDeclineDelivery(t *testing.T) {
	u, err := url.Parse(os.Getenv("OPENMENTOR_TEST_DATABASE_URL"))
	if err != nil || u.Host != "127.0.0.1:5546" || u.Path != "/openmentor_research_test" {
		t.Skip("requires dedicated isolated database on 127.0.0.1:5546")
	}
	repo := testRepository(t)
	mentor := insertMentor(t, repo, "flow-"+uuid.NewString(), mentorStatusActive)
	accepted := insertClientRequest(t, repo, mentor)
	declined := insertClientRequest(t, repo, mentor)
	done := make(chan struct{})
	cfg := &config.Config{}
	cfg.Server.AppEnv = "production"
	cfg.EventTriggers.RequestAcceptedTriggerURL = "http://trigger.invalid/?requestId="
	svc := services.NewMentorRequestsService(repository.NewClientRequestRepository(repo.pool), cfg, completedTriggerClient{done}, nil)
	ctx := context.Background()
	_, err = svc.AcceptRequest(ctx, mentor, accepted, "  mentor-private@example.test  ")
	require.NoError(t, err)
	<-done // Wait until the detached trigger has finished logging.
	_, err = svc.AcceptRequest(ctx, mentor, accepted, "other@example.test")
	require.Error(t, err)
	sender := &fakeEmailSender{failAll: true}
	h := NewHandlers(repo, sender, nil, cfg)
	sent, err := h.deliverAcceptance(ctx, accepted)
	require.Error(t, err)
	require.False(t, sent)
	sender.failAll = false
	// Failed sends retain a lease until its recovery window expires.
	_, err = repo.pool.Exec(ctx, `UPDATE client_requests SET acceptance_notification_claimed_at=now()-interval '16 minutes' WHERE id=$1`, accepted)
	require.NoError(t, err)
	summary, err := h.RetryAcceptanceNotifications(ctx)
	require.NoError(t, err)
	require.Equal(t, 1, summary.EmailsSent)
	require.Len(t, sender.attempts, 2)
	require.Equal(t, "mentee@example.com", sender.attempts[1].Recipient)
	require.Equal(t, "mentor-private@example.test", sender.attempts[1].Props["mentor_contact"])
	sent, err = h.deliverAcceptance(ctx, accepted)
	require.NoError(t, err)
	require.False(t, sent)
	require.Len(t, sender.attempts, 2)
	_, err = svc.DeclineRequest(ctx, mentor, declined, &models.DeclineRequestPayload{Reason: models.DeclineTopicMismatch, Comment: "not my topic"})
	require.NoError(t, err)
	rr := httptest.NewRecorder()
	ginctx, _ := gin.CreateTestContext(rr)
	ginctx.Request = httptest.NewRequest(http.MethodGet, "/jobs/request-process-finished?requestId="+declined, http.NoBody)
	h.RequestProcessFinished(ginctx)
	require.Equal(t, http.StatusOK, rr.Code)
	require.Len(t, sender.attempts, 3)
	require.Equal(t, "session-declined", sender.attempts[2].TemplateName)
	require.Equal(t, "mentee@example.com", sender.attempts[2].Recipient)
	require.NotContains(t, sender.attempts[2].Props, "mentor_contact")
}
