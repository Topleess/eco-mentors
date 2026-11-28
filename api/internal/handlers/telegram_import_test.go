package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
	"github.com/openmentor-io/openmentor/api/test/dbtest"
)

func TestTelegramImportRequiresAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	RegisterVacancyRoutes(r, nil, jwt.NewTokenManager(strings.Repeat("t", 64), "test", 1), nil, "", false)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("POST", "/api/v1/admin/telegram-vacancies/import", strings.NewReader(`{}`)))
	if w.Code != 401 {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestTelegramImportConcurrentIdempotency(t *testing.T) {
	if !strings.Contains(os.Getenv(dbtest.URLEnv), "openmentor_vacancies_test") {
		t.Skip("requires disposable test DB")
	}
	pool := dbtest.Pool(t)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	tm := jwt.NewTokenManager(strings.Repeat("t", 64), "test", 1)
	RegisterVacancyRoutes(r, pool, tm, nil, "", false)
	token, _ := tm.GenerateTokenWithRole(uuid.NewString(), 0, "admin@example.test", "Admin", "admin", 1)
	moderator, _ := tm.GenerateTokenWithRole(uuid.NewString(), 0, "mod@example.test", "Moderator", "moderator", 1)
	body := `{"message_id":791,"chat":{"id":-10077891},"text":"Вакансия\nТекст","photo":[{"file_id":"photo1"}],"source_url":"https://example.test/source"}`
	request := func(token string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/api/v1/admin/telegram-vacancies/import", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
		r.ServeHTTP(w, req)
		return w
	}
	if w := request(moderator); w.Code != 403 {
		t.Fatalf("moderator: %d %s", w.Code, w.Body.String())
	}
	const n = 12
	results := make(chan *httptest.ResponseRecorder, n)
	for i := 0; i < n; i++ {
		go func() { results <- request(token) }()
	}
	ids := map[string]bool{}
	created := 0
	for i := 0; i < n; i++ {
		w := <-results
		if w.Code != 200 && w.Code != 201 {
			t.Fatalf("import: %d %s", w.Code, w.Body.String())
		}
		if w.Code == 201 {
			created++
		}
		var result struct {
			Vacancy struct {
				ID string `json:"id"`
			} `json:"vacancy"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		ids[result.Vacancy.ID] = true
	}
	if len(ids) != 1 || created != 1 {
		t.Fatalf("ids=%v created=%d", ids, created)
	}
	var raw, photo, source, id string
	if err := pool.QueryRow(t.Context(), `SELECT vacancy_id,raw_text,photo_ids::text,source_url FROM telegram_vacancy_sources WHERE channel_id=-10077891 AND message_id=791`).Scan(&id, &raw, &photo, &source); err != nil {
		t.Fatal(err)
	}
	if raw != "Вакансия\nТекст" || !strings.Contains(photo, "photo1") || source != "https://example.test/source" {
		t.Fatalf("source %q %q %q", raw, photo, source)
	}
	defer pool.Exec(context.Background(), "DELETE FROM vacancies WHERE id=$1", id)
	req := httptest.NewRequest("GET", "/api/v1/admin/vacancies", http.NoBody)
	req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != 200 || !strings.Contains(w.Body.String(), id) || !strings.Contains(w.Body.String(), "reviewRequired") {
		t.Fatalf("admin list: %d %s", w.Code, w.Body.String())
	}
}
