package handlers

import (
	"context"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestVacancyApplicationRejectsMissingCaptcha(t *testing.T) {
	r := gin.New()
	RegisterVacancyRoutes(r, nil, nil, nil, "", false)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("POST", "/api/v1/vacancies/applications", strings.NewReader(`{"captchaToken":""}`)))
	if w.Code != 400 {
		t.Fatalf("missing captcha: got %d, want 400", w.Code)
	}
}

type rejectedVacancyCaptcha struct{ calls int }

func (v *rejectedVacancyCaptcha) Verify(_ context.Context, _ string) error {
	v.calls++
	return errors.New("rejected")
}
func TestVacancyApplicationRejectsInvalidCaptchaBeforeDatabase(t *testing.T) {
	v := &rejectedVacancyCaptcha{}
	r := gin.New()
	RegisterVacancyRoutes(r, nil, nil, nil, "", false, v)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("POST", "/api/v1/vacancies/applications", strings.NewReader(`{"captchaToken":"invalid","contact":"private@example.org","consent":true}`)))
	if w.Code != 400 || v.calls != 1 {
		t.Fatalf("got status %d, calls %d", w.Code, v.calls)
	}
	if strings.Contains(w.Body.String(), "private@example.org") {
		t.Fatal("response disclosed contact")
	}
}
func TestVacancyApplicationRateLimit(t *testing.T) {
	r := gin.New()
	RegisterVacancyRoutes(r, nil, nil, nil, "", false)
	for i := 0; i < 6; i++ {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest("POST", "/api/v1/vacancies/applications", strings.NewReader(`{}`)))
		if i == 5 && w.Code != 429 {
			t.Fatalf("sixth request: got %d", w.Code)
		}
	}
}

func TestVacancyApplicationRequiresConsentBeforeCaptcha(t *testing.T) {
	v := &rejectedVacancyCaptcha{}
	r := gin.New()
	RegisterVacancyRoutes(r, nil, nil, nil, "", false, v)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("POST", "/api/v1/vacancies/applications", strings.NewReader(`{"captchaToken":"token","contact":"private@example.org"}`)))
	if w.Code != 400 || v.calls != 0 {
		t.Fatalf("missing consent: status %d captcha calls %d", w.Code, v.calls)
	}
}
