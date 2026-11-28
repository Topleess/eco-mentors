package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/openmentor-io/openmentor/api/internal/middleware"
	"github.com/openmentor-io/openmentor/api/internal/models"
	"github.com/stretchr/testify/require"
)

type photoVisibility bool

func (v photoVisibility) PublicMentorPhoto(context.Context, string) (bool, error) {
	return bool(v), nil
}

type photoStore struct{ calls int }

func (s *photoStore) ReadMentorPhoto(context.Context, string) ([]byte, error) {
	s.calls++
	return []byte("\x89PNG\r\n\x1a\nfixture"), nil
}
func TestMentorPhotoVisibility(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		name, id      string
		visible       bool
		status, calls int
	}{
		{"active", "11111111-2222-3333-4444-555555555555", true, 200, 1},
		{"unpublished", "11111111-2222-3333-4444-555555555555", false, 404, 0},
		{"invalid", "not-a-uuid", true, 400, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := &photoStore{}
			r := gin.New()
			RegisterMentorPhotoRoutes(r, photoVisibility(tc.visible), store)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/mentor-photos/"+tc.id, http.NoBody))
			require.Equal(t, tc.status, w.Code)
			require.Equal(t, tc.calls, store.calls)
			require.Equal(t, "no-store", w.Header().Get("Cache-Control"))
		})
	}
}

func TestPrivateMentorPhotoUsesAuthenticatedIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := &photoStore{}
	r := gin.New()
	r.GET("/own", func(c *gin.Context) {
		c.Set(middleware.MentorSessionContextKey, &models.MentorSession{MentorID: "11111111-2222-3333-4444-555555555555"})
	}, MentorOwnPhoto(store))
	r.GET("/missing", MentorOwnPhoto(store))
	for _, tc := range []struct {
		path   string
		status int
	}{{"/own", 200}, {"/missing", 401}} {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest("GET", tc.path, http.NoBody))
		require.Equal(t, tc.status, w.Code)
	}
	require.Equal(t, 1, store.calls)
}
