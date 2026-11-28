package worker

import (
	"context"
	"errors"
	"testing"
	"time"
)

type deadlineAcceptanceRepo struct{ *fakeRepo }

func (r deadlineAcceptanceRepo) ListPendingAcceptanceNotifications(ctx context.Context) ([]string, error) {
	deadline, ok := ctx.Deadline()
	if !ok || time.Until(deadline) > 2*time.Minute {
		return nil, errors.New("retry pass lacks a bounded deadline")
	}
	return nil, nil
}
func TestAcceptanceRetryPassHasDeadline(t *testing.T) {
	env := newJobsTestEnv()
	env.handlers.repo = deadlineAcceptanceRepo{env.repo}
	if _, err := env.handlers.RetryAcceptanceNotifications(context.Background()); err != nil {
		t.Fatal(err)
	}
}
