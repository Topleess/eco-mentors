package repository

import (
	"context"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/openmentor-io/openmentor/api/test/dbtest"
	"github.com/stretchr/testify/require"
)

func TestRevokedModeratorCannotReceiveLoginToken(t *testing.T) {
	dsn := os.Getenv(dbtest.URLEnv)
	if dsn == "" {
		t.Skip("disposable DB required")
	}
	u, err := url.Parse(dsn)
	require.NoError(t, err)
	require.Equal(t, "127.0.0.1:5547", u.Host)
	require.Equal(t, "/om_staff_test", u.Path)
	pool := dbtest.Pool(t)
	ctx := context.Background()
	id := seedModerator(t, pool, "admin", "revoked-login")
	_, err = pool.Exec(ctx, `UPDATE moderators SET role='revoked', revoked_role='admin', session_version=session_version+1 WHERE id=$1`, id)
	require.NoError(t, err)
	err = NewModeratorRepository(pool).SetLoginToken(ctx, id, "atk_revoked_test", time.Now().Add(time.Hour))
	require.Error(t, err)
	var token *string
	require.NoError(t, pool.QueryRow(ctx, `SELECT login_token FROM moderators WHERE id=$1`, id).Scan(&token))
	require.Nil(t, token)
}

func TestConcurrentLoginIssuanceLosesToRevocationAndReinstatement(t *testing.T) {
	dsn := os.Getenv(dbtest.URLEnv)
	if dsn == "" {
		t.Skip("disposable DB required")
	}
	u, err := url.Parse(dsn)
	require.NoError(t, err)
	require.Equal(t, "127.0.0.1:5547", u.Host)
	require.Equal(t, "/om_staff_test", u.Path)
	pool := dbtest.Pool(t)
	ctx := context.Background()
	id := seedModerator(t, pool, "admin", "issue-race")
	repo := NewModeratorRepository(pool)
	_, version, err := repo.ModeratorSessionState(ctx, id)
	require.NoError(t, err)
	tx, err := pool.Begin(ctx)
	require.NoError(t, err)
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `UPDATE moderators SET role='revoked', revoked_role='admin', session_version=session_version+1, login_token=NULL WHERE id=$1`, id)
	require.NoError(t, err)
	done := make(chan error, 1)
	go func() { done <- repo.SetLoginToken(ctx, id, "atk_old", time.Now().Add(time.Hour), version) }()
	select {
	case err := <-done:
		t.Fatalf("issuance did not wait for locked row: %v", err)
	case <-time.After(100 * time.Millisecond):
	}
	require.NoError(t, tx.Commit(ctx))
	require.Error(t, <-done)
	_, err = pool.Exec(ctx, `UPDATE moderators SET role='admin', revoked_role=NULL, session_version=session_version+1 WHERE id=$1`, id)
	require.NoError(t, err)
	require.Error(t, repo.SetLoginToken(ctx, id, "atk_old", time.Now().Add(time.Hour), version))
	var token *string
	require.NoError(t, pool.QueryRow(ctx, `SELECT login_token FROM moderators WHERE id=$1`, id).Scan(&token))
	require.Nil(t, token)
	_, current, err := repo.ModeratorSessionState(ctx, id)
	require.NoError(t, err)
	require.NoError(t, repo.SetLoginToken(ctx, id, "atk_new", time.Now().Add(time.Hour), current))
	_, err = repo.ConsumeLoginToken(ctx, "atk_new")
	require.NoError(t, err)
}
