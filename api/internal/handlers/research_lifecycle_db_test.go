package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
	"github.com/openmentor-io/openmentor/api/test/dbtest"
)

const researchManual = "manual"
const researchArchived = "archived"

func researchFixture() gin.H {
	return gin.H{"slug": "research-" + uuid.NewString(), "title": "Учебное исследование", "summary": "Демонстрационный материал", "category": "Экология", "author": "Редакция демо", "publishedOn": "2026-11-01", "readingMinutes": 5, "sections": []gin.H{{"id": "overview", "title": "Обзор", "body": "Учебный пример."}}, "keyFindings": []string{}, "status": "draft"}
}

func TestResearchLifecycle(t *testing.T) {
	guardResearchDB(t)
	pool := dbtest.Pool(t)
	gin.SetMode(gin.TestMode)
	tm := jwt.NewTokenManager(strings.Repeat("r", 64), "research-tests", 1)
	admin, _ := tm.GenerateTokenWithRole(uuid.NewString(), 0, "admin@example.test", "Demo", "admin", 1)
	mod, _ := tm.GenerateTokenWithRole(uuid.NewString(), 0, "mod@example.test", "Demo", "moderator", 1)
	router := func() *gin.Engine { r := gin.New(); RegisterResearchRoutes(r, pool, tm, nil, "", false); return r }
	r := router()
	call := func(method, path string, p interface{}, auth string) *httptest.ResponseRecorder {
		b, _ := json.Marshal(p)
		req := httptest.NewRequest(method, "/api/v1"+path, bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
		if auth != "" {
			req.AddCookie(&http.Cookie{Name: "admin_session", Value: auth})
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}
	check := func(method, path string, p interface{}, auth string, code int) map[string]interface{} {
		t.Helper()
		w := call(method, path, p, auth)
		if w.Code != code {
			t.Fatalf("%s %s expected %d got %d %s", method, path, code, w.Code, w.Body.String())
		}
		var body map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		return body
	}
	for _, route := range []struct{ m, p string }{{"GET", "/admin/research"}, {"POST", "/admin/research"}, {"GET", "/admin/research/x"}, {"PUT", "/admin/research/x"}} {
		check(route.m, route.p, nil, "", 401)
		check(route.m, route.p, nil, mod, 403)
	}
	p := researchFixture()
	p["provenance"] = "synthetic"
	p["id"] = uuid.NewString()
	p["createdAt"] = "forged"
	p["updatedAt"] = "forged"
	p["version"] = 99
	got := check("POST", "/admin/research", p, admin, 201)["research"].(map[string]interface{})
	id := got["id"].(string)
	slug := p["slug"].(string)
	t.Cleanup(func() {
		_, err := pool.Exec(context.Background(), "DELETE FROM research WHERE id=$1", id)
		if err != nil {
			t.Error(err)
		}
	})
	if got["provenance"] != researchManual || got["version"] != float64(1) || got["id"] == p["id"] || got["createdAt"] == "forged" {
		t.Fatal(got)
	}
	check("GET", "/research/"+slug, nil, "", 404)
	check("GET", "/admin/research/"+id, nil, admin, 200)
	check("POST", "/admin/research", p, admin, 409)
	p["version"] = 1
	p["status"] = researchPublished
	got = check("PUT", "/admin/research/"+id, p, admin, 200)["research"].(map[string]interface{})
	if got["version"] != float64(2) {
		t.Fatal(got)
	}
	check("PUT", "/admin/research/"+id, p, admin, 409)
	r = router()
	check("GET", "/research/"+slug, nil, "", 200)
	list := check("GET", "/research", nil, "", 200)["research"].([]interface{})
	found := false
	for _, v := range list {
		if v.(map[string]interface{})["id"] == id {
			found = true
		}
	}
	if !found {
		t.Fatal("published article missing")
	}
	p["version"] = 2
	p["slug"] = "research-" + uuid.NewString()
	check("PUT", "/admin/research/"+id, p, admin, 409)
	p["slug"] = slug
	var wg sync.WaitGroup
	codes := make(chan int, 2)
	for range 2 {
		wg.Go(func() { codes <- call("PUT", "/admin/research/"+id, p, admin).Code })
	}
	wg.Wait()
	close(codes)
	counts := map[int]int{}
	for c := range codes {
		counts[c]++
	}
	if counts[200] != 1 || counts[409] != 1 {
		t.Fatal(counts)
	}
	p["version"] = 3
	p["status"] = researchArchived
	check("PUT", "/admin/research/"+id, p, admin, 200)
	check("GET", "/research/"+slug, nil, "", 404)
	check("GET", "/admin/research/not-a-uuid", nil, admin, 400)
	check("PUT", "/admin/research/"+uuid.NewString(), p, admin, 404)
	for _, bad := range []gin.H{{"title": ""}, {"title": strings.Repeat("я", 241)}, {"summary": strings.Repeat("x", 2001)}, {"category": strings.Repeat("x", 121)}, {"author": strings.Repeat("x", 241)}, {"publishedOn": "2026-02-30"}, {"readingMinutes": 0}, {"readingMinutes": 241}, {"readingMinutes": 1.5}, {"status": "other"}, {"coverAlt": strings.Repeat("x", 301)}, {"citation": strings.Repeat("x", 2001)}, {"sections": []gin.H{}}, {"sections": []gin.H{{"id": "same", "title": "a", "body": "b"}, {"id": "same", "title": "a", "body": "b"}}}, {"sections": []gin.H{{"id": "BAD", "title": "a", "body": "b"}}}, {"sections": []gin.H{{"id": "ok", "title": "a", "body": strings.Repeat("x", 20001)}}}, {"keyFindings": []string{strings.Repeat("x", 2001)}}} {
		v := researchFixture()
		for k, value := range bad {
			v[k] = value
		}
		check("POST", "/admin/research", v, admin, 400)
	}
	for _, u := range []string{"javascript:alert(1)", "data:text/plain,x", "//evil.test/a", "http://evil.test/a", "https://u:p@evil.test/a", "/research-assets/../secret", "/research-assets/%2e%2e/secret", "/research-assets/a\\b", "https://evil.test/a\n", "/research-assets/%252e%252e/secret", "https://evil.test/%2e%2e/a"} {
		for _, field := range []string{"coverUrl", "pdfUrl"} {
			v := researchFixture()
			v[field] = u
			check("POST", "/admin/research", v, admin, 400)
		}
	}
	huge := researchFixture()
	huge["unknown"] = strings.Repeat("x", 1048576)
	check("POST", "/admin/research", huge, admin, 400)
	// Existing synthetic provenance cannot be overwritten by an editor.
	_, err := pool.Exec(t.Context(), "UPDATE research SET provenance='synthetic' WHERE id=$1", id)
	if err != nil {
		t.Fatal(err)
	}
	p["version"] = 4
	p["provenance"] = researchManual
	got = check("PUT", "/admin/research/"+id, p, admin, 200)["research"].(map[string]interface{})
	if got["provenance"] != "synthetic" {
		t.Fatal(got)
	}
}
