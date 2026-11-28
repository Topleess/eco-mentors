package handlers

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
	"github.com/openmentor-io/openmentor/api/internal/repository"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
	"github.com/openmentor-io/openmentor/api/test/dbtest"
	"github.com/stretchr/testify/require"
)

func TestStaffDatabaseConcurrentLastAdminAndRevocation(t *testing.T) {
	dsn := os.Getenv(dbtest.URLEnv)
	if dsn == "" {
		t.Skip("disposable database not configured")
	}
	parsed, err := url.Parse(dsn)
	require.NoError(t, err)
	require.Equal(t, "127.0.0.1:5547", parsed.Host)
	require.Equal(t, "/om_staff_test", parsed.Path)
	pool := dbtest.Pool(t)
	ctx := context.Background()
	a, b := uuid.NewString(), uuid.NewString()
	_, err = pool.Exec(ctx, `INSERT INTO moderators(id,name,email,role) VALUES ($1,'A',$3,'admin'),($2,'B',$4,'admin')`, a, b, a+"@example.invalid", b+"@example.invalid")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM staff_account_audit WHERE actor_id = ANY($1::uuid[])`, []string{a, b})
		_, _ = pool.Exec(context.Background(), `DELETE FROM moderators WHERE id = ANY($1::uuid[])`, []string{a, b})
	})
	store := staffDB{pool}
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, pair := range [][2]string{{a, b}, {b, a}} {
		wg.Add(1)
		go func(actor, target string) {
			defer wg.Done()
			results <- store.Update(ctx, actor, 1, target, "moderator", true)
		}(pair[0], pair[1])
	}
	wg.Wait()
	close(results)
	success := 0
	for err := range results {
		if err == nil {
			success++
		} else {
			require.ErrorIs(t, err, errStaffForbidden)
		}
	}
	require.Equal(t, 1, success)
	var admins int
	require.NoError(t, pool.QueryRow(ctx, `SELECT count(*) FROM moderators WHERE id = ANY($1::uuid[]) AND role='admin'`, []string{a, b}).Scan(&admins))
	require.Equal(t, 1, admins)
	var admin, mod string
	require.NoError(t, pool.QueryRow(ctx, `SELECT id FROM moderators WHERE id = ANY($1::uuid[]) AND role='admin'`, []string{a, b}).Scan(&admin))
	if admin == a {
		mod = b
	} else {
		mod = a
	}
	require.ErrorIs(t, store.Update(ctx, admin, 1, admin, "admin", false), errStaffLastAdmin)
	repo := repository.NewModeratorRepository(pool)
	_, before, err := repo.ModeratorSessionState(ctx, mod)
	require.NoError(t, err)
	tm := jwt.NewTokenManager("test-secret", "test", 1)
	token, err := tm.GenerateTokenWithRole(mod, 0, "", "", "moderator", before)
	require.NoError(t, err)
	router := gin.New()
	RegisterStaffRoutes(router, pool, tm, repo, "", false)
	request := func() int {
		req := httptest.NewRequest("GET", "/api/v1/admin/staff", http.NoBody)
		req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w.Code
	}
	require.Equal(t, 403, request())
	require.NoError(t, store.Update(ctx, admin, 1, mod, "moderator", false))
	require.Equal(t, 401, request())
	role, after, err := repo.ModeratorSessionState(ctx, mod)
	require.NoError(t, err)
	require.Equal(t, "revoked", role)
	require.Greater(t, after, before)
	require.NoError(t, store.Update(ctx, admin, 1, mod, "moderator", true))
	role, reinstated, err := repo.ModeratorSessionState(ctx, mod)
	require.NoError(t, err)
	require.Equal(t, "moderator", role)
	require.Greater(t, reinstated, after)
	require.Equal(t, 401, request())
}

// pausedStaffChecker captures the middleware's live read before another admin
// changes the account, modeling a request already in flight.
type pausedStaffChecker struct {
	repo   *repository.ModeratorRepository
	read   chan struct{}
	resume chan struct{}
}

func (p pausedStaffChecker) ModeratorSessionState(ctx context.Context, id string) (string, int, error) {
	role, version, err := p.repo.ModeratorSessionState(ctx, id)
	close(p.read)
	select {
	case <-p.resume:
	case <-ctx.Done():
		return "", 0, ctx.Err()
	}
	return role, version, err
}

func TestStaffInflightStaleSessionCannotMutate(t *testing.T) {
	dsn := os.Getenv(dbtest.URLEnv)
	if dsn == "" {
		t.Skip("disposable database not configured")
	}
	parsed, err := url.Parse(dsn)
	require.NoError(t, err)
	require.Equal(t, "127.0.0.1:5547", parsed.Host)
	require.Equal(t, "/om_staff_test", parsed.Path)
	pool := dbtest.Pool(t)
	ctx := context.Background()
	store := staffDB{pool}
	for _, tc := range []struct {
		name, method   string
		legacy, revoke bool
	}{
		{"revoke-reinstate-create", "POST", false, true},
		{"demote-promote-update", "PUT", false, false},
		{"legacy-revoke-reinstate-create", "POST", true, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			actor, other, target := uuid.NewString(), uuid.NewString(), uuid.NewString()
			ids := []string{actor, other, target}
			_, err := pool.Exec(ctx, `INSERT INTO moderators(id,name,email,role) VALUES ($1,'actor',$4,'admin'),($2,'other',$5,'admin'),($3,'target',$6,'moderator')`, actor, other, target, actor+"@example.invalid", other+"@example.invalid", target+"@example.invalid")
			require.NoError(t, err)
			t.Cleanup(func() {
				_, _ = pool.Exec(ctx, `DELETE FROM staff_account_audit WHERE actor_id=ANY($1::uuid[])`, ids)
				_, _ = pool.Exec(ctx, `DELETE FROM moderators WHERE id=ANY($1::uuid[])`, ids)
			})
			var version int
			require.NoError(t, pool.QueryRow(ctx, `SELECT session_version FROM moderators WHERE id=$1`, actor).Scan(&version))
			if tc.legacy {
				version = 0
			}
			tm := jwt.NewTokenManager("test-secret", "test", 1)
			token, err := tm.GenerateTokenWithRole(actor, 0, "", "", "admin", version)
			require.NoError(t, err)
			gate := pausedStaffChecker{repository.NewModeratorRepository(pool), make(chan struct{}), make(chan struct{})}
			router := gin.New()
			RegisterStaffRoutes(router, pool, tm, gate, "", false)
			path, body := "/api/v1/admin/staff", `{"name":"Unauthorized","email":"`+actor+`@created.invalid","role":"moderator"}`
			if tc.method == "PUT" {
				path += "/" + target
				body = `{"role":"admin","active":true}`
			}
			req := httptest.NewRequest(tc.method, path, strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
			done := make(chan int, 1)
			go func() { w := httptest.NewRecorder(); router.ServeHTTP(w, req); done <- w.Code }()
			<-gate.read
			if tc.revoke {
				require.NoError(t, store.Update(ctx, other, 1, actor, "admin", false))
				require.NoError(t, store.Update(ctx, other, 1, actor, "admin", true))
			} else {
				require.NoError(t, store.Update(ctx, other, 1, actor, "moderator", true))
				require.NoError(t, store.Update(ctx, other, 1, actor, "admin", true))
			}
			close(gate.resume)
			require.Equal(t, 403, <-done)
			var count int
			require.NoError(t, pool.QueryRow(ctx, `SELECT count(*) FROM staff_account_audit WHERE actor_id=$1`, actor).Scan(&count))
			require.Zero(t, count)
			var role string
			require.NoError(t, pool.QueryRow(ctx, `SELECT role FROM moderators WHERE id=$1`, target).Scan(&role))
			require.Equal(t, "moderator", role)
		})
	}
}

func TestStaffAuthorizationSessionVersionBaseline(t *testing.T) {
	dsn := os.Getenv(dbtest.URLEnv)
	if dsn == "" {
		t.Skip("disposable database not configured")
	}
	parsed, err := url.Parse(dsn)
	require.NoError(t, err)
	require.Equal(t, "127.0.0.1:5547", parsed.Host)
	require.Equal(t, "/om_staff_test", parsed.Path)
	pool := dbtest.Pool(t)
	ctx := context.Background()
	actor := uuid.NewString()
	_, err = pool.Exec(ctx, `INSERT INTO moderators(id,name,email,role) VALUES ($1,'actor',$2,'admin')`, actor, actor+"@example.invalid")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM staff_account_audit WHERE actor_id=$1`, actor)
		_, _ = pool.Exec(ctx, `DELETE FROM moderators WHERE email LIKE $1`, actor+"%@example.invalid")
		_, _ = pool.Exec(ctx, `DELETE FROM moderators WHERE id=$1`, actor)
	})
	store := staffDB{pool}
	account := func(suffix string) staffAccount {
		return staffAccount{Name: "test", Email: actor + suffix + "@example.invalid", Role: "moderator"}
	}
	require.NoError(t, store.Create(ctx, actor, 0, account("legacy")))
	require.NoError(t, store.Create(ctx, actor, 1, account("current")))
	require.ErrorIs(t, store.Create(ctx, actor, -1, account("negative")), errStaffForbidden)
	require.ErrorIs(t, store.Create(ctx, actor, 2, account("future")), errStaffForbidden)
	_, err = pool.Exec(ctx, `UPDATE moderators SET session_version=session_version+1 WHERE id=$1`, actor)
	require.NoError(t, err)
	require.ErrorIs(t, store.Create(ctx, actor, 0, account("oldlegacy")), errStaffForbidden)
	require.ErrorIs(t, store.Create(ctx, actor, 1, account("oldcurrent")), errStaffForbidden)
	require.NoError(t, store.Create(ctx, actor, 2, account("newcurrent")))
}
