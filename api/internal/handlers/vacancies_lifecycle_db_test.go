package handlers

import (
	"bytes"
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

func TestVacancyPersistenceLifecycle(t *testing.T) {
	if !strings.Contains(os.Getenv(dbtest.URLEnv), "openmentor_vacancies_test") {
		t.Skip("requires explicitly disposable vacancy database")
	}
	pool := dbtest.Pool(t)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	tm := jwt.NewTokenManager(strings.Repeat("t", 64), "vacancy-tests", 1)
	RegisterVacancyRoutes(r, pool, tm, nil, "", false)
	token, err := tm.GenerateTokenWithRole(uuid.NewString(), 0, "admin@example.test", "Synthetic admin", "admin", 1)
	if err != nil {
		t.Fatal(err)
	}
	request := func(method, path string, payload interface{}, auth string, code int) map[string]interface{} {
		t.Helper()
		var data []byte
		if payload != nil {
			data, _ = json.Marshal(payload)
		}
		req := httptest.NewRequest(method, "/api/v1"+path, bytes.NewReader(data))
		req.Header.Set("Content-Type", "application/json")
		if auth != "" {
			req.AddCookie(&http.Cookie{Name: "admin_session", Value: auth})
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != code {
			t.Fatalf("%s %s: expected %d got %d %s", method, path, code, w.Code, w.Body.String())
		}
		var body map[string]interface{}
		if err = json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		return body
	}
	for _, path := range []string{"/admin/vacancies", "/admin/vacancy-industries", "/admin/vacancy-cities"} {
		request("GET", path, nil, "", 401)
	}
	moderator, _ := tm.GenerateTokenWithRole(uuid.NewString(), 0, "moderator@example.test", "Synthetic moderator", "moderator", 1)
	for _, path := range []string{"/admin/vacancies", "/admin/vacancies/x", "/admin/vacancy-industries", "/admin/vacancy-industries/x", "/admin/vacancy-cities", "/admin/vacancy-cities/x"} {
		for _, method := range []string{"GET", "POST", "PUT", "DELETE"} {
			if method == "GET" && (strings.HasSuffix(path, "industries/x") || strings.HasSuffix(path, "cities/x")) || method == "DELETE" && strings.Contains(path, "vacancies") || method == "POST" && strings.HasSuffix(path, "/x") || method == "PUT" && !strings.HasSuffix(path, "/x") || method == "DELETE" && !strings.HasSuffix(path, "/x") {
				continue
			}
			request(method, path, map[string]interface{}{}, moderator, 403)
		}
	}
	slug := "test-" + uuid.NewString()
	industry := request("POST", "/admin/vacancy-industries", gin.H{"slug": slug, "name": "Test industry", "active": true}, token, 201)["item"].(map[string]interface{})
	city := request("POST", "/admin/vacancy-cities", gin.H{"slug": slug, "name": "Test city", "active": true}, token, 201)["item"].(map[string]interface{})
	industryID := industry["id"].(string)
	cityID := city["id"].(string)
	defer func() {
		_, _ = pool.Exec(t.Context(), "DELETE FROM vacancies WHERE slug=$1", slug)
		_, _ = pool.Exec(t.Context(), "DELETE FROM vacancy_industries WHERE id=$1", industryID)
		_, _ = pool.Exec(t.Context(), "DELETE FROM vacancy_cities WHERE id=$1", cityID)
	}()
	payload := gin.H{"slug": slug, "title": "Fictional job", "company": "Fictional company", "industryId": industryID, "cityId": cityID, "status": "draft", "workFormat": "remote", "experience": "junior", "employment": "fullTime", "description": "Example", "responsibilities": []string{"Example task"}, "requirements": []string{}, "conditions": []string{}, "salary": nil, "provenance": "synthetic"}
	job := request("POST", "/admin/vacancies", payload, token, 201)["vacancy"].(map[string]interface{})
	id := job["id"].(string)
	if job["industry"] != "Test industry" || job["location"] != "Test city" {
		t.Fatal(job)
	}
	request("GET", "/vacancies/"+slug, nil, "", 404)
	payload["version"] = job["version"]
	payload["status"] = "published"
	published := request("PUT", "/admin/vacancies/"+id, payload, token, 200)["vacancy"].(map[string]interface{})
	request("PUT", "/admin/vacancies/"+id, payload, token, 409)
	got := request("GET", "/vacancies/"+slug, nil, "", 200)["vacancy"].(map[string]interface{})
	if got["status"] != "published" || got["provenance"] != "synthetic" {
		t.Fatal(got)
	}
	request("PUT", "/admin/vacancy-cities/"+cityID, gin.H{"slug": slug, "name": "Renamed city", "active": true, "version": city["version"]}, token, 200)
	got = request("GET", "/vacancies/"+slug, nil, "", 200)["vacancy"].(map[string]interface{})
	if got["location"] != "Renamed city" {
		t.Fatal(got)
	}
	request("DELETE", "/admin/vacancy-cities/"+cityID, nil, token, 409)
	request("PUT", "/admin/vacancy-cities/"+cityID, gin.H{"slug": slug, "name": "Stale name", "active": true, "version": 1}, token, 409)
	request("PUT", "/admin/vacancy-cities/"+cityID, gin.H{"slug": slug, "name": "Renamed city", "active": false, "version": 2}, token, 200)
	inactivePublic := request("GET", "/vacancies/dictionaries", nil, "", 200)
	for _, entry := range inactivePublic["cities"].([]interface{}) {
		if entry.(map[string]interface{})["id"] == cityID {
			t.Fatal("inactive city exposed in public choices")
		}
	}
	payload["slug"] = slug + "-inactive"
	request("POST", "/admin/vacancies", payload, token, 400)
	payload["slug"] = slug
	// Existing assignments remain editable after a dictionary is deactivated.
	payload["version"] = published["version"]
	payload["status"] = "archived"
	request("PUT", "/admin/vacancies/"+id, payload, token, 200)
	request("GET", "/vacancies/"+slug, nil, "", 404)
	request("PUT", "/admin/vacancy-cities/"+cityID, gin.H{"slug": slug, "name": "Renamed city", "active": true, "version": 3}, token, 200)
	request("POST", "/admin/vacancies", payload, token, 409)
	payload["salary"] = gin.H{"min": 200, "max": 100, "currency": "RUB"}
	request("POST", "/admin/vacancies", payload, token, 400)
	payload["salary"] = nil
	payload["cityId"] = "missing"
	request("POST", "/admin/vacancies", payload, token, 400)
	items := request("GET", "/vacancies/dictionaries", nil, "", 200)
	if items["cities"] == nil || items["industries"] == nil {
		t.Fatal(items)
	}
	request("POST", "/admin/vacancy-cities", gin.H{"slug": "bad slug", "name": "Bad", "active": true}, token, 400)
}
