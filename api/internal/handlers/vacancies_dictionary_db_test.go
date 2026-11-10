package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
	"github.com/openmentor-io/openmentor/api/test/dbtest"
)

func TestMissingDictionaryUpdateIsNotFound(t *testing.T) {
	pool := dbtest.Pool(t)
	r := gin.New()
	tm := jwt.NewTokenManager(strings.Repeat("t", 64), "vacancy-tests", 1)
	RegisterVacancyRoutes(r, pool, tm, nil, "", false)
	token, err := tm.GenerateTokenWithRole(uuid.NewString(), 0, "admin@example.test", "Synthetic admin", "admin", 1)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("PUT", "/api/v1/admin/vacancy-cities/missing", strings.NewReader(`{"slug":"missing","name":"Missing","active":true,"version":1}`))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != 404 {
		t.Fatalf("expected 404 got %d %s", w.Code, w.Body.String())
	}
}
