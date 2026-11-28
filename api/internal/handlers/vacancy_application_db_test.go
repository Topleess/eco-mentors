package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openmentor-io/openmentor/api/test/dbtest"
	"github.com/stretchr/testify/require"
)

type acceptedVacancyCaptcha struct{}

func (acceptedVacancyCaptcha) Verify(context.Context, string) error { return nil }

func TestVacancyApplicationPrivateContactPersistence(t *testing.T) {
	pool := dbtest.Pool(t)
	ctx := context.Background()
	slug := "application-test-" + uuid.NewString()
	var industry, city string
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO vacancy_industries(slug,name) VALUES ($1,'Test') RETURNING id`, slug).Scan(&industry))
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM vacancy_industries WHERE id=$1`, industry) })
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO vacancy_cities(slug,name) VALUES ($1,'Test') RETURNING id`, slug).Scan(&city))
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM vacancy_cities WHERE id=$1`, city) })
	r := gin.New()
	RegisterVacancyRoutes(r, pool, nil, nil, "", false, acceptedVacancyCaptcha{})
	payload := gin.H{"title": "Fictional job", "company": "Fictional company", "industryId": industry, "cityId": city, "workFormat": "remote", "experience": "junior", "employment": "fullTime", "contact": " private@example.test ", "consent": true, "captchaToken": "ok"}
	body, err := json.Marshal(payload)
	require.NoError(t, err)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("POST", "/api/v1/vacancies/applications", bytes.NewReader(body)))
	require.Equal(t, 201, w.Code, w.Body.String())
	require.NotContains(t, w.Body.String(), "private@example.test")
	var id, status, contact, storedPayload string
	err = pool.QueryRow(ctx, `SELECT v.id,v.status,a.contact,v.payload::text FROM vacancies v JOIN vacancy_applications a ON a.vacancy_id=v.id WHERE v.industry_id=$1`, industry).Scan(&id, &status, &contact, &storedPayload)
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM vacancies WHERE id=$1`, id) })
	require.Equal(t, "draft", status)
	require.Equal(t, "private@example.test", contact)
	require.False(t, strings.Contains(storedPayload, contact), "contact must not be stored in vacancy JSON")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/vacancies", http.NoBody))
	require.Equal(t, 200, w.Code)
	require.NotContains(t, w.Body.String(), contact)
	require.NotContains(t, w.Body.String(), id)
}
