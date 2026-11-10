package handlers

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/openmentor-io/openmentor/api/test/dbtest"
)

func guardResearchDB(t *testing.T) {
	t.Helper()
	u, err := url.Parse(os.Getenv(dbtest.URLEnv))
	if err != nil || u.Path != "/openmentor_research_test" || u.Host != "127.0.0.1:5546" {
		t.Skip("requires isolated research database on loopback 5546")
	}
}

func TestResearchPublicEmpty(t *testing.T) {
	guardResearchDB(t)
	pool := dbtest.Pool(t)
	r := gin.New()
	RegisterResearchRoutes(r, pool, nil, nil, "", false)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/research", http.NoBody))
	if w.Code != 200 || w.Body.String() != `{"research":[]}` {
		t.Fatalf("got %d %s", w.Code, w.Body.String())
	}
}
