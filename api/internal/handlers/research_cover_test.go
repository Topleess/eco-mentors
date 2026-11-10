package handlers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
	"github.com/openmentor-io/openmentor/api/pkg/logger"
	"github.com/openmentor-io/openmentor/api/pkg/s3storage"
	"github.com/openmentor-io/openmentor/api/test/imagefixture"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type coverMemoryStore map[string][]byte

func (s coverMemoryStore) UploadResearchCover(_ context.Context, b []byte, _ string) (string, error) {
	id := uuid.NewString()
	s[id] = append([]byte(nil), b...)
	return id, nil
}
func (s coverMemoryStore) ReadResearchCover(_ context.Context, id string) ([]byte, error) {
	return s[id], nil
}

func TestResearchCoverUploadReadback(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tm := jwt.NewTokenManager("test-secret", "test", 1)
	r := gin.New()
	store := coverMemoryStore{}
	RegisterResearchRoutes(r, nil, tm, nil, "", false)
	RegisterResearchCoverRoutes(r, tm, nil, "", false, store)
	data := imagefixture.PhotoPNG(t, 40, 40)
	body, _ := json.Marshal(map[string]string{"image": "data:image/png;base64," + base64.StdEncoding.EncodeToString(data), "contentType": "image/png"})
	request := func(role string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("POST", "/api/v1/admin/research/covers", bytes.NewReader(body))
		if role != "" {
			token, err := tm.GenerateTokenWithRole(uuid.NewString(), 0, "", "", role, 0)
			require.NoError(t, err)
			req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}
	require.Equal(t, 401, request("").Code)
	require.Equal(t, 403, request("moderator").Code)
	w := request("admin")
	require.Equal(t, 201, w.Code, w.Body.String())
	var v struct {
		CoverURL string `json:"coverUrl"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &v))
	require.True(t, researchAsset(v.CoverURL))
	get := httptest.NewRecorder()
	r.ServeHTTP(get, httptest.NewRequest("GET", "/api/v1/research/covers/"+v.CoverURL[len("/api/research/covers/"):], http.NoBody))
	require.Equal(t, 200, get.Code)
	require.Equal(t, data, get.Body.Bytes())
	require.Equal(t, "image/png", get.Header().Get("Content-Type"))
	require.Equal(t, "nosniff", get.Header().Get("X-Content-Type-Options"))
	require.Len(t, store, 1)
}
func TestResearchCoverRejectsInvalidInputs(t *testing.T) {
	tm := jwt.NewTokenManager("test-secret", "test", 1)
	token, err := tm.GenerateTokenWithRole(uuid.NewString(), 0, "", "", "admin", 0)
	require.NoError(t, err)
	data := imagefixture.PhotoPNG(t, 40, 40)
	for _, tc := range []struct{ name, image, kind string }{
		{"svg", "<svg/>", "image/svg+xml"},
		{"magic", "not an image", "image/png"},
		{"truncated", string(data[:40]), "image/png"},
		{"mismatch", string(data), "image/jpeg"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := coverMemoryStore{}
			r := gin.New()
			RegisterResearchCoverRoutes(r, tm, nil, "", false, store)
			body, _ := json.Marshal(map[string]string{"image": "data:" + tc.kind + ";base64," + base64.StdEncoding.EncodeToString([]byte(tc.image)), "contentType": tc.kind})
			req := httptest.NewRequest("POST", "/api/v1/admin/research/covers", bytes.NewReader(body))
			req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			require.Equal(t, 400, w.Code)
			require.Empty(t, store)
		})
	}
}

func TestResearchCoverUnavailable(t *testing.T) {
	tm := jwt.NewTokenManager("test-secret", "test", 1)
	token, err := tm.GenerateTokenWithRole(uuid.NewString(), 0, "", "", "admin", 0)
	require.NoError(t, err)
	for _, store := range []ResearchCoverStorage{nil, (*s3storage.StorageClient)(nil)} {
		r := gin.New()
		RegisterResearchCoverRoutes(r, tm, nil, "", false, store)
		for _, method := range []string{"GET", "POST"} {
			path := "/api/v1/research/covers/" + uuid.NewString()
			if method == "POST" {
				path = "/api/v1/admin/research/covers"
			}
			data := imagefixture.PhotoPNG(t, 40, 40)
			body, _ := json.Marshal(map[string]string{"image": "data:image/png;base64," + base64.StdEncoding.EncodeToString(data), "contentType": "image/png"})
			req := httptest.NewRequest(method, path, bytes.NewReader(body))
			req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			require.Equal(t, 503, w.Code)
		}
	}
}

func TestResearchCoverAssetAllowlist(t *testing.T) {
	id := uuid.NewString()
	require.True(t, researchAsset("/api/research/covers/"+id))
	for _, s := range []string{"/api/research/covers/" + id + "?q=x", "/api/research/covers/" + id + "#x", "/api/research/covers/../x", "/api/other/" + id, "/api/research/covers/" + strings.ReplaceAll(id, "-", "")} {
		require.False(t, researchAsset(s), s)
	}
}

func TestResearchCoverHTTPStoredBytesRoundTrip(t *testing.T) {
	logger.Log = zap.NewNop()
	objects := map[string][]byte{}
	var mu sync.Mutex
	bucket := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch r.Method {
		case "PUT":
			data, err := io.ReadAll(r.Body)
			require.NoError(t, err)
			objects[r.URL.Path] = data
		case "GET":
			data, ok := objects[r.URL.Path]
			if !ok {
				w.WriteHeader(404)
				return
			}
			_, _ = w.Write(data)
		default:
			t.Errorf("unexpected storage operation: %s", r.Method)
		}
	}))
	defer bucket.Close()
	store, err := s3storage.NewStorageClient("test", "test", "research-media", bucket.URL, "auto")
	require.NoError(t, err)
	tm := jwt.NewTokenManager("test-secret", "test", 1)
	token, err := tm.GenerateTokenWithRole(uuid.NewString(), 0, "", "", "admin", 0)
	require.NoError(t, err)
	r := gin.New()
	RegisterResearchCoverRoutes(r, tm, nil, "", false, store)
	data := imagefixture.PhotoPNG(t, 40, 40)
	body, _ := json.Marshal(map[string]string{"image": "data:image/png;base64," + base64.StdEncoding.EncodeToString(data), "contentType": "image/png"})
	req := httptest.NewRequest("POST", "/api/v1/admin/research/covers", bytes.NewReader(body))
	req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, 201, w.Code, w.Body.String())
	var v struct {
		CoverURL string `json:"coverUrl"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &v))
	get := httptest.NewRecorder()
	r.ServeHTTP(get, httptest.NewRequest("GET", strings.Replace(v.CoverURL, "/api/", "/api/v1/", 1), http.NoBody))
	require.Equal(t, 200, get.Code, get.Body.String())
	require.Equal(t, data, get.Body.Bytes())
	mu.Lock()
	defer mu.Unlock()
	require.Len(t, objects, 1)
}
