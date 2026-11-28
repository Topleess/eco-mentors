package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openmentor-io/openmentor/api/pkg/logger"
	"github.com/openmentor-io/openmentor/api/pkg/metrics"
	"github.com/openmentor-io/openmentor/api/pkg/s3storage"
	"github.com/openmentor-io/openmentor/api/test/imagefixture"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

// Requires a disposable, isolated database and Garage bucket, never production.
func TestMentorPhotoGarageIntegration(t *testing.T) {
	dbURL := os.Getenv("MENTOR_PHOTO_TEST_DB")
	endpoint := os.Getenv("MENTOR_PHOTO_TEST_S3")
	if dbURL == "" || endpoint == "" {
		t.Skip("isolated Garage and database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dbURL)
	require.NoError(t, err)
	require.Equal(t, "phototest", cfg.ConnConfig.Database)
	require.Equal(t, "127.0.0.1", cfg.ConnConfig.Host)
	require.Equal(t, uint16(5597), cfg.ConnConfig.Port)
	require.Equal(t, "http://127.0.0.1:3990", endpoint)
	cfg.MaxConns = 1
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	require.NoError(t, err)
	defer db.Close()
	_, err = db.Exec(ctx, `CREATE TEMPORARY TABLE mentors (id uuid PRIMARY KEY, status text NOT NULL, deleted_at timestamptz)`)
	require.NoError(t, err)
	id := "11111111-2222-3333-4444-555555555555"
	_, err = db.Exec(ctx, `INSERT INTO mentors(id,status) VALUES($1,'active')`, id)
	require.NoError(t, err)
	access, secret := os.Getenv("MENTOR_PHOTO_TEST_KEY"), os.Getenv("MENTOR_PHOTO_TEST_SECRET")
	metrics.Init("photo-test")
	image := imagefixture.PhotoPNG(t, 50, 50)
	previousLogger := logger.Log
	logger.Log = zap.NewNop()
	defer func() { logger.Log = previousLogger }()
	store, err := s3storage.NewStorageClient(access, secret, "photos", endpoint, "garage")
	require.NoError(t, err)
	_, err = store.UploadProfileImage(ctx, image, id, "image/png")
	require.NoError(t, err)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	RegisterMentorPhotoRoutes(r, MentorPhotoDatabase{Pool: db}, store)
	get := func() *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/mentor-photos/"+id, http.NoBody))
		return w
	}
	w := get()
	require.Equal(t, 200, w.Code)
	require.Equal(t, image, w.Body.Bytes())
	require.Equal(t, "image/png", w.Header().Get("Content-Type"))
	require.Equal(t, "no-store", w.Header().Get("Cache-Control"))
	_, err = db.Exec(ctx, `UPDATE mentors SET status='pending' WHERE id=$1`, id)
	require.NoError(t, err)
	require.Equal(t, 404, get().Code)
	_, err = db.Exec(ctx, `UPDATE mentors SET status='active', deleted_at=NOW() WHERE id=$1`, id)
	require.NoError(t, err)
	require.Equal(t, 404, get().Code)
}
