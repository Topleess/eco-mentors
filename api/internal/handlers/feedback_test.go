package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"sort"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openmentor-io/openmentor/api/internal/middleware"
	"github.com/openmentor-io/openmentor/api/internal/repository"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
	"github.com/openmentor-io/openmentor/api/test/dbtest"
	"github.com/stretchr/testify/require"
)

const feedbackTestID = "8af54c15-003a-4418-899d-78b13734114e"

type feedbackTestCaptcha func(string) error

func (v feedbackTestCaptcha) Verify(_ context.Context, token string) error { return v(token) }

func feedbackRequest(r http.Handler, method, path, body, cookie string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if cookie != "" {
		req.AddCookie(&http.Cookie{Name: middleware.AdminSessionCookieName, Value: cookie})
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func feedbackBody(t *testing.T, changes map[string]any) string {
	t.Helper()
	fields := map[string]any{"submissionId": feedbackTestID, "category": "suggestion", "message": "  line one\nline two  ", "consent": true, "captchaToken": "ok"}
	for k, v := range changes {
		fields[k] = v
	}
	body, err := json.Marshal(fields)
	require.NoError(t, err)
	return string(body)
}

func TestFeedbackRejectsInvalidInputsBeforeCaptcha(t *testing.T) {
	for name, change := range map[string]map[string]any{
		"missing consent": {"consent": nil}, "false consent": {"consent": false}, "bad UUID": {"submissionId": "not a UUID"},
		"bad variant":        {"submissionId": "8af54c15-003a-4418-c99d-78b13734114e"},
		"wrong UUID version": {"submissionId": "8af54c15-003a-1418-899d-78b13734114e"},
		"category":           {"category": "other"}, "blank message": {"message": " \n "}, "long message": {"message": strings.Repeat("я", 3001)},
		"NUL message": {"message": "hi\x00there"}, "invalid email": {"email": "Someone <test@example.invalid>"},
		"null email": {"email": nil}, "missing captcha": {"captchaToken": nil}, "long captcha": {"captchaToken": strings.Repeat("x", 4097)},
	} {
		t.Run(name, func(t *testing.T) {
			r := gin.New()
			RegisterFeedbackRoutes(r, nil, nil, nil, "", false, feedbackTestCaptcha(func(string) error { t.Fatal("captcha called on invalid input"); return nil }))
			w := feedbackRequest(r, "POST", "/api/v1/feedback", feedbackBody(t, change), "")
			require.Equal(t, 400, w.Code, w.Body.String())
		})
	}
}

func TestFeedbackFailsClosedWhenCaptchaRejects(t *testing.T) {
	for _, verifier := range []vacancyCaptcha{nil, feedbackTestCaptcha(func(string) error { return errors.New("synthetic failure") })} {
		r := gin.New()
		RegisterFeedbackRoutes(r, nil, nil, nil, "", false, verifier)
		w := feedbackRequest(r, "POST", "/api/v1/feedback", feedbackBody(t, nil), "")
		require.Equal(t, 400, w.Code, w.Body.String())
		require.NotContains(t, w.Body.String(), "synthetic failure")
	}
}

func TestFeedbackBodyAndRateLimits(t *testing.T) {
	r := gin.New()
	RegisterFeedbackRoutes(r, nil, nil, nil, "", false, nil)
	body := feedbackBody(t, nil) + strings.Repeat(" ", 64*1024)
	require.Equal(t, 413, feedbackRequest(r, "POST", "/api/v1/feedback", body, "").Code)
	for range 4 {
		require.Equal(t, 400, feedbackRequest(r, "POST", "/api/v1/feedback", "{}", "").Code)
	}
	require.Equal(t, 429, feedbackRequest(r, "POST", "/api/v1/feedback", "{}", "").Code)
}

func TestFeedbackDatabasePersistsAndDeduplicates(t *testing.T) {
	pool := dbtest.Pool(t)
	id := uuid.NewString()
	t.Cleanup(func() {
		_, err := pool.Exec(context.Background(), `DELETE FROM feedback_submissions WHERE id=$1`, id)
		require.NoError(t, err)
	})
	verifierCalls := 0
	verifier := feedbackTestCaptcha(func(token string) error {
		verifierCalls++
		if token == "bad" {
			return errors.New("bad captcha")
		}
		return nil
	})
	r := gin.New()
	RegisterFeedbackRoutes(r, feedbackAPIPool(t), nil, nil, "", false, verifier)
	for _, tc := range []struct {
		token, message string
		want           int
	}{
		{"first", "  line one\nline two  ", 201}, {"second", "line one\nline two", 201},
		{"bad", "line one\nline two", 400}, {"fourth", "different", 409},
	} {
		w := feedbackRequest(r, "POST", "/api/v1/feedback", feedbackBody(t, map[string]any{"submissionId": id, "captchaToken": tc.token, "message": tc.message}), "")
		require.Equal(t, tc.want, w.Code, w.Body.String())
		if tc.want == 201 {
			require.JSONEq(t, `{"success":true}`, w.Body.String())
		}
		require.NotContains(t, w.Body.String(), id)
		require.NotContains(t, w.Body.String(), "line one")
	}
	require.Equal(t, 4, verifierCalls)
	var category, message string
	var email *string
	require.NoError(t, pool.QueryRow(t.Context(), `SELECT category,message,email FROM feedback_submissions WHERE id=$1`, id).Scan(&category, &message, &email))
	require.Equal(t, "suggestion", category)
	require.Equal(t, "line one\nline two", message)
	require.Nil(t, email)
}

func TestFeedbackDatabaseConcurrentReplayAndGrants(t *testing.T) {
	pool := dbtest.Pool(t)
	id := uuid.NewString()
	t.Cleanup(func() {
		_, err := pool.Exec(context.Background(), `DELETE FROM feedback_submissions WHERE id=$1`, id)
		require.NoError(t, err)
	})
	var workerReadWrite, apiUpdateDelete bool
	require.NoError(t, pool.QueryRow(t.Context(), `SELECT
		has_table_privilege('om_worker','feedback_submissions','SELECT,INSERT,UPDATE,DELETE'),
		has_table_privilege('om_api','feedback_submissions','UPDATE,DELETE')`).Scan(&workerReadWrite, &apiUpdateDelete))
	require.False(t, workerReadWrite)
	require.False(t, apiUpdateDelete)
	r := gin.New()
	RegisterFeedbackRoutes(r, feedbackAPIPool(t), nil, nil, "", false, feedbackTestCaptcha(func(string) error { return nil }))
	body := feedbackBody(t, map[string]any{"submissionId": id, "email": "test@example.invalid", "message": strings.Repeat("я", 3000)})
	const attempts = 5
	start := make(chan struct{})
	responses := make(chan *httptest.ResponseRecorder, attempts)
	for range attempts {
		go func() {
			<-start
			responses <- feedbackRequest(r, "POST", "/api/v1/feedback", body, "")
		}()
	}
	close(start)
	for range attempts {
		w := <-responses
		require.Equal(t, 201, w.Code, w.Body.String())
		require.JSONEq(t, `{"success":true}`, w.Body.String())
	}
	var count int
	require.NoError(t, pool.QueryRow(t.Context(), `SELECT count(*) FROM feedback_submissions WHERE id=$1 AND email=$2`, id, "test@example.invalid").Scan(&count))
	require.Equal(t, 1, count)
}

func feedbackAPIPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	cfg, err := pgxpool.ParseConfig(os.Getenv(dbtest.URLEnv))
	require.NoError(t, err)
	cfg.ConnConfig.RuntimeParams["role"] = "om_api"
	pool, err := pgxpool.NewWithConfig(t.Context(), cfg)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	return pool
}

func TestFeedbackDatabaseAdminInbox(t *testing.T) {
	pool := dbtest.Pool(t)
	id, mod := uuid.NewString(), uuid.NewString()
	_, err := pool.Exec(t.Context(), `INSERT INTO moderators(id,name,email,role) VALUES ($1,'Test',$1::uuid::text || '@example.invalid','admin'),($2,'Test',$2::uuid::text || '@example.invalid','moderator')`, id, mod)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, e := pool.Exec(context.Background(), `DELETE FROM moderators WHERE id IN ($1,$2)`, id, mod)
		require.NoError(t, e)
	})
	tm := jwt.NewTokenManager(strings.Repeat("a", 64), "test", 1)
	token := func(id, role string, version int) string {
		s, e := tm.GenerateTokenWithRole(id, 0, "", "", role, version)
		require.NoError(t, e)
		return s
	}
	r := gin.New()
	api := feedbackAPIPool(t)
	RegisterFeedbackRoutes(r, api, tm, repository.NewModeratorRepository(api), "", false, nil)
	admin := token(id, "admin", 1)
	const path = "/api/v1/admin/feedback"
	for _, tc := range []struct {
		cookie string
		want   int
	}{{"", 401}, {token(mod, "moderator", 1), 403}, {token(id, "admin", 2), 401}, {admin, 200}} {
		w := feedbackRequest(r, "GET", path, "", tc.cookie)
		require.Equal(t, tc.want, w.Code, w.Body.String())
		require.Equal(t, "no-store", w.Header().Get("Cache-Control"))
	}
	for _, off := range []string{"-1", "a", "10001", ""} {
		require.Equal(t, 400, feedbackRequest(r, "GET", path+"?offset="+off, "", admin).Code)
	}
	ids := make([]string, 26)
	for i := range ids {
		ids[i] = uuid.NewString()
	}
	// Use a synthetic fixed timestamp to exercise ordering by id on a tie.
	_, err = pool.Exec(t.Context(), `INSERT INTO feedback_submissions(id,category,message,email,created_at) SELECT id,'question','Test inbox','feedback@example.invalid','2099-01-01' FROM unnest($1::uuid[]) AS id`, ids)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, e := pool.Exec(context.Background(), `DELETE FROM feedback_submissions WHERE id=ANY($1::uuid[])`, ids)
		require.NoError(t, e)
	})
	sort.Sort(sort.Reverse(sort.StringSlice(ids)))
	first := feedbackRequest(r, "GET", path+"?offset=0", "", admin)
	require.Equal(t, 200, first.Code, first.Body.String())
	var page struct {
		Items   []struct{ ID, Category, Message, Email, CreatedAt string }
		HasMore bool
	}
	require.NoError(t, json.Unmarshal(first.Body.Bytes(), &page))
	require.Len(t, page.Items, 25)
	require.True(t, page.HasMore)
	require.Equal(t, ids[0], page.Items[0].ID)
	require.Equal(t, ids[24], page.Items[24].ID)
	require.Equal(t, "question", page.Items[0].Category)
	require.Equal(t, "Test inbox", page.Items[0].Message)
	require.Equal(t, "feedback@example.invalid", page.Items[0].Email)
	require.Equal(t, "2099-01-01T00:00:00Z", page.Items[0].CreatedAt)
	second := feedbackRequest(r, "GET", path+"?offset=25", "", admin)
	require.Equal(t, 200, second.Code, second.Body.String())
	require.NoError(t, json.Unmarshal(second.Body.Bytes(), &page))
	require.NotEmpty(t, page.Items)
	require.Equal(t, ids[25], page.Items[0].ID)
	_, err = pool.Exec(t.Context(), `UPDATE moderators SET role='revoked',revoked_role='admin',session_version=2 WHERE id=$1`, id)
	require.NoError(t, err)
	require.Equal(t, 401, feedbackRequest(r, "GET", path, "", admin).Code)
}
