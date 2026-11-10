package s3storage

import (
	"io"
	"net/http"
	"testing"

	"github.com/openmentor-io/openmentor/api/test/imagefixture"
	"github.com/stretchr/testify/require"
)

func TestResearchCoverStorageRoundTrip(t *testing.T) {
	objects := map[string][]byte{}
	client := clientFor(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "PUT":
			require.Contains(t, r.URL.Path, "/research-covers/")
			require.Equal(t, "*", r.Header.Get("If-None-Match"))
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
			t.Errorf("unexpected method %s", r.Method)
		}
	})
	data := imagefixture.PhotoPNG(t, 40, 40)
	id, err := client.UploadResearchCover(t.Context(), data, "image/png")
	require.NoError(t, err)
	other, err := client.UploadResearchCover(t.Context(), data, "image/png")
	require.NoError(t, err)
	require.NotEqual(t, id, other)
	got, err := client.ReadResearchCover(t.Context(), id)
	require.NoError(t, err)
	require.Equal(t, data, got)
	_, err = client.ReadResearchCover(t.Context(), "../mentor/full")
	require.Error(t, err)
	_, err = client.UploadResearchCover(t.Context(), data[:40], "image/png")
	require.Error(t, err)
}

func TestResearchCoverRejectsInvalidStoredBytes(t *testing.T) {
	data := imagefixture.PhotoPNG(t, 40, 40)
	client := clientFor(t, func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write(data[:40]) })
	_, err := client.ReadResearchCover(t.Context(), "11111111-1111-4111-8111-111111111111")
	require.Error(t, err)
}

func TestResearchCoverRejectsSizeAndGeometry(t *testing.T) {
	client, bucket := recordingClient(t)
	for _, data := range [][]byte{make([]byte, MaxImageBytes+1), imagefixture.BombPNG(t, 10000, 10000)} {
		_, err := client.UploadResearchCover(t.Context(), data, "image/png")
		require.Error(t, err)
	}
	require.Empty(t, bucket.byMethod("PUT"))
}
