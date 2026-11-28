package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
	"github.com/openmentor-io/openmentor/api/test/dbtest"
)

func TestTelegramVacancyPreviewRejectsOversizedUTF16(t *testing.T) {
	input := `{"title":"` + strings.Repeat("😀", 2050) + `","company":"A"}`
	if _, err := telegramVacancyText([]byte(input)); err == nil {
		t.Fatal("oversized Telegram text accepted")
	}
}

func TestTelegramVacancyPreviewUsesSavedPublicFields(t *testing.T) {
	got, err := telegramVacancyText([]byte(`{"title":"Инженер","company":"Компания","description":"Подробнее: https://example.org"}`))
	if err != nil || got != "Инженер\nКомпания\n\nПодробнее: https://example.org" {
		t.Fatalf("preview = %q, %v", got, err)
	}
}

func TestTelegramVacancyPreviewIncludesSavedListsAndSource(t *testing.T) {
	got, err := telegramVacancyText([]byte(`{"title":"Engineer","company":"Acme","description":"Details","responsibilities":["Build"],"requirements":["Go","SQL"],"conditions":["Remote"]}`), telegramVacancyLinks{SourceURL: "https://t.me/jobs/123", PublicBaseURL: "https://example.org", Slug: "engineer"})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Build", "Go", "SQL", "Remote", "https://t.me/jobs/123", "https://example.org/vacancies/engineer"} {
		if !strings.Contains(got, want) {
			t.Errorf("preview missing %q: %q", want, got)
		}
	}
}

func TestTelegramVacancyPreviewRejectsInvalidLinksAndLongSections(t *testing.T) {
	payload := []byte(`{"title":"Job","company":"Acme","requirements":["` + strings.Repeat("😀", 2050) + `"]}`)
	if _, err := telegramVacancyText(payload); err == nil {
		t.Fatal("oversized requirements accepted")
	}
	payload = []byte(`{"title":"Job","company":"Acme"}`)
	for _, links := range []telegramVacancyLinks{{SourceURL: "javascript:alert(1)"}, {PublicBaseURL: "not-a-url", Slug: "job"}, {PublicBaseURL: "https://example.org?query=1", Slug: "job"}} {
		if _, err := telegramVacancyText(payload, links); err == nil {
			t.Errorf("invalid links accepted: %+v", links)
		}
	}
	text, err := telegramVacancyText(payload, telegramVacancyLinks{})
	if err != nil || strings.Contains(text, "http") {
		t.Fatalf("unexpected invented URL: %q %v", text, err)
	}
}

func TestTelegramVacancyPreviewMatchesSentText(t *testing.T) {
	pool := dbtest.Pool(t)
	ctx := context.Background()
	suffix := uuid.NewString()
	var industry, city, id string
	if err := pool.QueryRow(ctx, `INSERT INTO vacancy_industries(slug,name) VALUES($1,'test') RETURNING id`, "i-"+suffix).Scan(&industry); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM vacancy_industries WHERE id=$1`, industry) })
	if err := pool.QueryRow(ctx, `INSERT INTO vacancy_cities(slug,name) VALUES($1,'test') RETURNING id`, "c-"+suffix).Scan(&city); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM vacancy_cities WHERE id=$1`, city) })
	slug := "v-" + suffix
	if err := pool.QueryRow(ctx, `INSERT INTO vacancies(slug,industry_id,city_id,status,payload) VALUES($1,$2,$3,'published',$4) RETURNING id`, slug, industry, city, `{"title":"Job","company":"Acme","requirements":["Go"],"conditions":["Remote"]}`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM vacancy_telegram_publications WHERE vacancy_id=$1`, id)
		_, _ = pool.Exec(ctx, `DELETE FROM vacancies WHERE id=$1`, id)
	})
	if _, err := pool.Exec(ctx, `INSERT INTO telegram_vacancy_sources(channel_id,message_id,vacancy_id,raw_text,photo_ids,source_url) VALUES($1,$2,$3,'raw','[]','https://t.me/jobs/123')`, -1001234567, 1, id); err != nil {
		t.Fatal(err)
	}
	var sent string
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		var body struct {
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Error(err)
		}
		sent = body.Text
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"ok":true,"result":{"message_id":42}}`))}, nil
	})}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	tm := jwt.NewTokenManager(strings.Repeat("x", 64), "test", 1)
	RegisterTelegramVacancyRoutes(r, pool, tm, nil, "", false, TelegramVacancyOptions{Token: "fake", ChatID: "-1", Client: client, PublicBaseURL: "https://example.org"})
	admin, err := tm.GenerateTokenWithRole(uuid.NewString(), 0, "admin@example.test", "Admin", "admin", 1)
	if err != nil {
		t.Fatal(err)
	}
	request := func(action, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("POST", "/api/v1/admin/vacancies/"+id+"/telegram/"+action, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{Name: "admin_session", Value: admin})
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}
	preview := request("preview", "{}")
	var result struct {
		Text    string `json:"text"`
		Version int    `json:"version"`
	}
	if preview.Code != 200 {
		t.Fatalf("preview: %d %s", preview.Code, preview.Body.String())
	}
	if err := json.Unmarshal(preview.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Go", "Remote", "https://t.me/jobs/123", "https://example.org/vacancies/" + slug} {
		if !strings.Contains(result.Text, want) {
			t.Errorf("missing %q in %q", want, result.Text)
		}
	}
	published := request("publish", fmt.Sprintf(`{"version":%d}`, result.Version))
	if published.Code != 200 || sent != result.Text {
		t.Fatalf("publish %d, sent %q, preview %q", published.Code, sent, result.Text)
	}
}

func TestTelegramDraftPreviewDoesNotSend(t *testing.T) {
	pool := dbtest.Pool(t)
	ctx := context.Background()
	suffix := uuid.NewString()
	var industry, city, id string
	if err := pool.QueryRow(ctx, `INSERT INTO vacancy_industries(slug,name) VALUES($1,'test') RETURNING id`, "i-"+suffix).Scan(&industry); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM vacancy_industries WHERE id=$1`, industry) })
	if err := pool.QueryRow(ctx, `INSERT INTO vacancy_cities(slug,name) VALUES($1,'test') RETURNING id`, "c-"+suffix).Scan(&city); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM vacancy_cities WHERE id=$1`, city) })
	if err := pool.QueryRow(ctx, `INSERT INTO vacancies(slug,industry_id,city_id,status,payload) VALUES($1,$2,$3,'draft',$4) RETURNING id`, "v-"+suffix, industry, city, `{"title":"Saved draft","company":"Acme"}`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM vacancies WHERE id=$1`, id) })
	calls := 0
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		return nil, fmt.Errorf("unexpected external request")
	})}
	r := gin.New()
	tm := jwt.NewTokenManager(strings.Repeat("x", 64), "test", 1)
	RegisterTelegramVacancyRoutes(r, pool, tm, nil, "", false, TelegramVacancyOptions{Token: "fake", ChatID: "fake", Client: client, PublicBaseURL: "https://example.org"})
	admin, err := tm.GenerateTokenWithRole(uuid.NewString(), 0, "admin@example.test", "Admin", "admin", 1)
	if err != nil {
		t.Fatal(err)
	}
	request := func(action, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("POST", "/api/v1/admin/vacancies/"+id+"/telegram/"+action, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{Name: "admin_session", Value: admin})
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}
	preview := request("preview", "{}")
	if preview.Code != 200 || !strings.Contains(preview.Body.String(), "Saved draft") {
		t.Fatalf("draft preview: %d %s", preview.Code, preview.Body.String())
	}
	var result struct {
		Version int `json:"version"`
	}
	if err := json.Unmarshal(preview.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	publish := request("publish", fmt.Sprintf(`{"version":%d}`, result.Version))
	if publish.Code != 409 || calls != 0 {
		t.Fatalf("draft publish: %d, external calls %d", publish.Code, calls)
	}
}
