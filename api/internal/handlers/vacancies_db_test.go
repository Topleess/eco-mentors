package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/openmentor-io/openmentor/api/test/dbtest"
)

func TestVacanciesPublicEmptyDatabase(t *testing.T) {
	pool := dbtest.Pool(t)
	router := gin.New()
	RegisterVacancyRoutes(router, pool, nil, nil, "", false)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/vacancies", http.NoBody))
	if w.Code != 200 || w.Body.String() != `{"vacancies":[]}` {
		t.Fatalf("got %d %s", w.Code, w.Body.String())
	}
}
