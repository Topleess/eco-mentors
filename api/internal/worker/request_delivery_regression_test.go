package worker

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

// A repeated trigger must not notify the same mentee twice.
func TestDeclineDeliveryReplayDoesNotDuplicate(t *testing.T) {
	env := newJobsTestEnv()
	env.repo.requestsWithMentor[finishedRequestID] = finishedRequest("declined")
	path := "/jobs/request-process-finished?requestId=" + finishedRequestID
	require.Equal(t, http.StatusOK, env.do(http.MethodGet, path, nil).Code)
	require.Equal(t, http.StatusOK, env.do(http.MethodGet, path, nil).Code)
	require.Len(t, env.sender.attempts, 1, "replayed decline must not resend")
}

func TestNewRequestDeliveryRetriesOnlyFailedRecipient(t *testing.T) {
	env := newJobsTestEnv()
	env.repo.mentors["m1"] = testMentor("m1")
	env.repo.requests["r1"] = testRequest("r1", "m1")
	env.sender.failTemplates["new-request-mentor"] = true
	path := "/jobs/new-request-watcher?requestId=r1"
	require.Equal(t, http.StatusServiceUnavailable, env.do(http.MethodPost, path, nil).Code)
	env.sender.failTemplates["new-request-mentor"] = false
	require.Equal(t, http.StatusOK, env.do(http.MethodPost, path, nil).Code)
	require.Equal(t, []string{"new-request", "new-request-mentor", "new-request-moderator", "new-request-mentor"}, env.sender.templates(), "retry must send only the failed mentor notification")
}
