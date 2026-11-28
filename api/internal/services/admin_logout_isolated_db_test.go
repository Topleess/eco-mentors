package services

import (
	"context"
	"net/url"
	"os"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/openmentor-io/openmentor/api/internal/repository"
	"github.com/openmentor-io/openmentor/api/test/dbtest"
	"github.com/stretchr/testify/require"
)

func TestAdminLogoutRejectsStaleTokens(t *testing.T) {
	dsn := os.Getenv(dbtest.URLEnv)
	if dsn == "" {
		t.Skip("isolated database required")
	}
	u, err := url.Parse(dsn)
	require.NoError(t, err)
	require.Equal(t, "127.0.0.1:5559", u.Host)
	require.Equal(t, "/om_admin_logout_test", u.Path)
	pool := dbtest.Pool(t)
	ctx := context.Background()
	id := uuid.NewString()
	_, err = pool.Exec(ctx, `INSERT INTO moderators (id, name, email, role) VALUES ($1, 'Logout Test', $2, 'admin')`, id, id+"@example.test")
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM moderators WHERE id=$1`, id) })
	repo := repository.NewModeratorRepository(pool)
	svc := NewAdminAuthService(repo, authServiceConfig(), nil, nil)
	token := func(version int) string {
		s, e := svc.tokenManager.GenerateTokenWithRole(id, 0, "", "Logout Test", "admin", version)
		require.NoError(t, e)
		return s
	}
	version := func() int { _, v, e := repo.ModeratorSessionState(ctx, id); require.NoError(t, e); return v }
	require.Equal(t, 1, version())
	legacy := token(0)
	require.NoError(t, svc.RevokeSession(ctx, legacy))
	require.Equal(t, 2, version())
	require.NoError(t, svc.RevokeSession(ctx, legacy))
	require.Equal(t, 2, version(), "stale legacy replay must not revoke current sessions")
	current := token(2)
	require.NoError(t, svc.RevokeSession(ctx, current))
	require.Equal(t, 3, version())
	require.NoError(t, svc.RevokeSession(ctx, current))
	require.Equal(t, 3, version(), "stale versioned replay must not revoke current sessions")
}

func TestAdminLogoutConcurrentReplay(t *testing.T) {
	dsn := os.Getenv(dbtest.URLEnv)
	if dsn == "" {
		t.Skip("isolated database required")
	}
	u, err := url.Parse(dsn)
	require.NoError(t, err)
	require.Equal(t, "127.0.0.1:5559", u.Host)
	require.Equal(t, "/om_admin_logout_test", u.Path)
	pool := dbtest.Pool(t)
	ctx := context.Background()
	id := uuid.NewString()
	_, err = pool.Exec(ctx, `INSERT INTO moderators (id, name, email, role) VALUES ($1, 'Race Test', $2, 'admin')`, id, id+"@example.test")
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM moderators WHERE id=$1`, id) })
	repo := repository.NewModeratorRepository(pool)
	svc := NewAdminAuthService(repo, authServiceConfig(), nil, nil)
	token, err := svc.tokenManager.GenerateTokenWithRole(id, 0, "", "Race Test", "admin", 1)
	require.NoError(t, err)
	const n = 24
	start := make(chan struct{})
	errs := make(chan error, n)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); <-start; errs <- svc.RevokeSession(ctx, token) }()
	}
	close(start)
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}
	_, version, err := repo.ModeratorSessionState(ctx, id)
	require.NoError(t, err)
	require.Equal(t, 2, version, "one token may increment the version only once")
}
