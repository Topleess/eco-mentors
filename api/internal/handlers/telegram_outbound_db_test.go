package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
	"github.com/openmentor-io/openmentor/api/test/dbtest"
)

func TestTelegramVacancyPublicationGuard(t *testing.T) {
	pool := dbtest.Pool(t)
	ctx := context.Background()
	suffix := uuid.NewString()
	var industry, city, id string
	if err := pool.QueryRow(ctx, `INSERT INTO vacancy_industries(slug,name) VALUES($1,'test') RETURNING id`, "i-"+suffix).Scan(&industry); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO vacancy_cities(slug,name) VALUES($1,'test') RETURNING id`, "c-"+suffix).Scan(&city); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO vacancies(slug,industry_id,city_id,status,payload) VALUES($1,$2,$3,'published',$4) RETURNING id`, "v-"+suffix, industry, city, `{"title":"Job","company":"Acme","description":"Details"}`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, `DELETE FROM vacancy_telegram_publications WHERE vacancy_id=$1`, id)
		pool.Exec(ctx, `DELETE FROM vacancies WHERE id=$1`, id)
		pool.Exec(ctx, `DELETE FROM vacancy_industries WHERE id=$1`, industry)
		pool.Exec(ctx, `DELETE FROM vacancy_cities WHERE id=$1`, city)
	})
	var sends atomic.Int32
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		sends.Add(1)
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"ok":true,"result":{"message_id":42}}`))}, nil
	})}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	tm := jwt.NewTokenManager(strings.Repeat("x", 64), "test", 1)
	RegisterTelegramVacancyRoutes(r, pool, tm, nil, "", false, TelegramVacancyOptions{Token: "fake", ChatID: "-1", Client: client})
	admin, _ := tm.GenerateTokenWithRole(uuid.NewString(), 0, "admin@example.test", "Admin", "admin", 1)
	mod, _ := tm.GenerateTokenWithRole(uuid.NewString(), 0, "mod@example.test", "Mod", "moderator", 1)
	request := func(action, body, token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("POST", "/api/v1/admin/vacancies/"+id+"/telegram/"+action, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}
	if w := request("preview", "{}", ""); w.Code != 401 {
		t.Fatalf("unauth %d", w.Code)
	}
	if w := request("preview", "{}", mod); w.Code != 403 {
		t.Fatalf("moderator %d", w.Code)
	}
	w := request("preview", "{}", admin)
	var preview struct {
		Text    string `json:"text"`
		Version int    `json:"version"`
	}
	json.Unmarshal(w.Body.Bytes(), &preview)
	if w.Code != 200 || preview.Version != 1 || preview.Text != "Job\nAcme\n\nDetails" {
		t.Fatalf("preview %d %s", w.Code, w.Body.String())
	}
	if w = request("publish", `{"version":2}`, admin); w.Code != 409 {
		t.Fatalf("stale %d", w.Code)
	}
	var wg sync.WaitGroup
	codes := make(chan int, 12)
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); codes <- request("publish", `{"version":1}`, admin).Code }()
	}
	wg.Wait()
	close(codes)
	for code := range codes {
		if code != 200 && code != 409 {
			t.Fatalf("publish code %d", code)
		}
	}
	if sends.Load() != 1 {
		t.Fatalf("sent %d times", sends.Load())
	}
	w = request("publish", `{"version":1}`, admin)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"messageId":42`) {
		t.Fatalf("retry %d %s", w.Code, w.Body.String())
	}
	// A transport error may mean Telegram accepted the message but its response
	// was lost. Subsequent attempts must not send again.
	pool.Exec(ctx, `DELETE FROM vacancy_telegram_publications WHERE vacancy_id=$1`, id)
	client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		sends.Add(1)
		return nil, io.ErrUnexpectedEOF
	})
	if w = request("publish", `{"version":1}`, admin); w.Code != 502 {
		t.Fatalf("ambiguous send %d %s", w.Code, w.Body.String())
	}
	if w = request("publish", `{"version":1}`, admin); w.Code != 409 || sends.Load() != 2 {
		t.Fatalf("ambiguous retry %d sends %d", w.Code, sends.Load())
	}
	pool.Exec(ctx, `UPDATE vacancies SET status='archived' WHERE id=$1`, id)
	if w = request("preview", "{}", admin); w.Code != 200 {
		t.Fatalf("archived preview %d", w.Code)
	}
	if w = request("publish", `{"version":1}`, admin); w.Code != 409 || sends.Load() != 2 {
		t.Fatalf("archived publication %d sends %d", w.Code, sends.Load())
	}
}
