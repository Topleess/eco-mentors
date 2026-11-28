package worker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func deliveryTestRepository(t *testing.T) *Repository {
	t.Helper()
	u, err := url.Parse(os.Getenv("OPENMENTOR_TEST_DATABASE_URL"))
	if err != nil || u.Host != "127.0.0.1:5546" || u.Path != "/openmentor_research_test" {
		t.Skip("requires disposable database 127.0.0.1:5546/openmentor_research_test")
	}
	return testRepository(t)
}
func invokeDelivery(h *Handlers, path string) int {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, path, http.NoBody)
	if strings.HasPrefix(path, "/jobs/new-request-") {
		h.NewRequestWatcher(c)
	} else {
		h.RequestProcessFinished(c)
	}
	return w.Code
}
func TestRequestDeliveryIsolatedRetryAndDecline(t *testing.T) {
	r := deliveryTestRepository(t)
	ctx := context.Background()
	mentor := insertMentor(t, r, "delivery-"+uuid.NewString(), mentorStatusActive)
	id := insertClientRequest(t, r, mentor)
	sender := &fakeEmailSender{failTemplates: map[string]bool{"new-request-mentor": true}}
	h := NewHandlers(r, sender, nil, productionRetryTestConfig())
	path := "/jobs/new-request-watcher?requestId=" + id
	require.Equal(t, http.StatusServiceUnavailable, invokeDelivery(h, path))
	require.Len(t, sender.attempts, 3)
	sender.failTemplates["new-request-mentor"] = false
	_, err := r.pool.Exec(ctx, `UPDATE request_deliveries SET next_attempt_at=now()-interval '1 second' WHERE request_id=$1`, id)
	require.NoError(t, err)
	_, err = h.RetryRequestDeliveries(ctx)
	require.NoError(t, err)
	require.Len(t, sender.attempts, 4)
	require.Equal(t, "new-request-mentor", sender.attempts[3].TemplateName)
	require.Equal(t, http.StatusOK, invokeDelivery(h, path))
	require.Len(t, sender.attempts, 4)
	_, err = r.pool.Exec(ctx, `UPDATE client_requests SET status='declined' WHERE id=$1`, id)
	require.NoError(t, err)
	sender.failTemplates["session-declined"] = true
	decline := "/jobs/request-process-finished?requestId=" + id
	require.Equal(t, http.StatusServiceUnavailable, invokeDelivery(h, decline))
	sender.failTemplates["session-declined"] = false
	require.Equal(t, http.StatusOK, invokeDelivery(h, decline))
	require.Equal(t, http.StatusOK, invokeDelivery(h, decline))
	require.Len(t, sender.attempts, 6)
}
func TestRequestDeliveryIsolatedConcurrentClaims(t *testing.T) {
	r := deliveryTestRepository(t)
	ctx := context.Background()
	mentor := insertMentor(t, r, "claims-"+uuid.NewString(), mentorStatusActive)
	id := insertClientRequest(t, r, mentor)
	const n = 12
	tokens := make(chan string, n)
	errs := make(chan error, n)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			token, err := r.ClaimRequestDelivery(ctx, id, "mentee")
			tokens <- token
			errs <- err
		}()
	}
	wg.Wait()
	close(tokens)
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}
	var winner string
	count := 0
	for token := range tokens {
		if token != "" {
			count++
			winner = token
		}
	}
	require.Equal(t, 1, count)
	ok, err := r.FinishRequestDelivery(ctx, id, "mentee", uuid.NewString(), true)
	require.NoError(t, err)
	require.False(t, ok)
	ok, err = r.FinishRequestDelivery(ctx, id, "mentee", winner, true)
	require.NoError(t, err)
	require.True(t, ok)
	token, err := r.ClaimRequestDelivery(ctx, id, "mentee")
	require.NoError(t, err)
	require.Empty(t, token)
}

func TestRequestDeliveryIsolatedDroppedCallbackAndStaleLease(t *testing.T) {
	r := deliveryTestRepository(t)
	ctx := context.Background()
	mentor := insertMentor(t, r, "recovery-"+uuid.NewString(), mentorStatusActive)
	id := insertClientRequest(t, r, mentor)
	// A process died after claiming, so only the expired token can be replaced.
	old, err := r.ClaimRequestDelivery(ctx, id, "mentee")
	require.NoError(t, err)
	require.NotEmpty(t, old)
	_, err = r.pool.Exec(ctx, `UPDATE request_deliveries SET claimed_at=now()-interval '4 minutes' WHERE request_id=$1 AND kind='mentee'`, id)
	require.NoError(t, err)
	replacement, err := r.ClaimRequestDelivery(ctx, id, "mentee")
	require.NoError(t, err)
	require.NotEmpty(t, replacement)
	require.NotEqual(t, old, replacement)
	ok, err := r.FinishRequestDelivery(ctx, id, "mentee", old, true)
	require.NoError(t, err)
	require.False(t, ok)
	ok, err = r.FinishRequestDelivery(ctx, id, "mentee", replacement, false)
	require.NoError(t, err)
	require.True(t, ok)
	_, err = r.pool.Exec(ctx, `UPDATE request_deliveries SET next_attempt_at=now()-interval '1 second' WHERE request_id=$1`, id)
	require.NoError(t, err)
	sender := &fakeEmailSender{}
	h := NewHandlers(r, sender, nil, productionRetryTestConfig())
	_, err = h.RetryRequestDeliveries(ctx)
	require.NoError(t, err)
	require.Len(t, sender.attempts, 3)
	// The decline trigger is also durable even without its callback.
	_, err = r.pool.Exec(ctx, `UPDATE client_requests SET status='declined' WHERE id=$1`, id)
	require.NoError(t, err)
	_, err = h.RetryRequestDeliveries(ctx)
	require.NoError(t, err)
	require.Len(t, sender.attempts, 4)
	require.Equal(t, "session-declined", sender.attempts[3].TemplateName)
	_, err = h.RetryRequestDeliveries(ctx)
	require.NoError(t, err)
	require.Len(t, sender.attempts, 4)
}
func TestRequestDeliveryIsolatedEventRollsBackWithRequest(t *testing.T) {
	r := deliveryTestRepository(t)
	ctx := context.Background()
	mentor := insertMentor(t, r, "rollback-"+uuid.NewString(), mentorStatusActive)
	tx, err := r.pool.Begin(ctx)
	require.NoError(t, err)
	var id string
	err = tx.QueryRow(ctx, `INSERT INTO client_requests(mentor_id,email,name,status) VALUES ($1,'rollback@example.test','Rollback','pending') RETURNING id`, mentor).Scan(&id)
	require.NoError(t, err)
	require.NoError(t, tx.Rollback(ctx))
	var count int
	err = r.pool.QueryRow(ctx, `SELECT count(*) FROM request_deliveries WHERE request_id=$1`, id).Scan(&count)
	require.NoError(t, err)
	require.Zero(t, count)
}
