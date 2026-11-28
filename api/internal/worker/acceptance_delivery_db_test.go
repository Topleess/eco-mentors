package worker

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestAcceptanceDeliveryConcurrentClaimsAndFencing(t *testing.T) {
	repo := testRepository(t)
	ctx := context.Background()
	mentor := insertMentor(t, repo, "acceptance-"+uuid.NewString(), mentorStatusActive)
	id := insertClientRequest(t, repo, mentor)
	_, err := repo.pool.Exec(ctx, `UPDATE client_requests SET accepted_at=now(), accepted_contact='private@example.test' WHERE id=$1`, id)
	require.NoError(t, err)
	const n = 12
	claims := make([]time.Time, n)
	errs := make([]error, n)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := range n {
		wg.Add(1)
		go func(i int) { defer wg.Done(); <-start; claims[i], errs[i] = repo.ClaimAcceptanceNotification(ctx, id) }(i)
	}
	close(start)
	wg.Wait()
	var winner time.Time
	count := 0
	for i := range n {
		require.NoError(t, errs[i])
		if !claims[i].IsZero() {
			winner = claims[i]
			count++
		}
	}
	require.Equal(t, 1, count)
	pending, err := repo.ListPendingAcceptanceNotifications(ctx)
	require.NoError(t, err)
	require.NotContains(t, pending, id)
	_, err = repo.pool.Exec(ctx, `UPDATE client_requests SET acceptance_notification_claimed_at=now()-interval '16 minutes' WHERE id=$1`, id)
	require.NoError(t, err)
	next, err := repo.ClaimAcceptanceNotification(ctx, id)
	require.NoError(t, err)
	require.False(t, next.IsZero())
	ok, err := repo.FinishAcceptanceNotification(ctx, id, winner, true)
	require.NoError(t, err)
	require.False(t, ok, "stale claim must not finalize")
	ok, err = repo.FinishAcceptanceNotification(ctx, id, next, true)
	require.NoError(t, err)
	require.True(t, ok)
	again, err := repo.ClaimAcceptanceNotification(ctx, id)
	require.NoError(t, err)
	require.True(t, again.IsZero(), "sent notification must never be reclaimed")
}
