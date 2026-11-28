package handlers

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type photoRoundTrip func(*http.Request) (*http.Response, error)

func (f photoRoundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestTelegramPhotoFetch(t *testing.T) {
	client := &http.Client{Transport: photoRoundTrip(func(r *http.Request) (*http.Response, error) {
		body := `{"ok":true,"result":{"file_path":"photos/file.jpg","file_size":4}}`
		if strings.Contains(r.URL.Path, "/file/bot") {
			body = "\xff\xd8\xff\xd9"
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})}
	data, typ, err := fetchTelegramPhoto(context.Background(), client, "fake-token", "photo1")
	if err != nil || typ != "image/jpeg" || len(data) != 4 {
		t.Fatalf("unexpected result %q %d %v", typ, len(data), err)
	}
}

func TestTelegramPhotoRejectsUnsafeResponses(t *testing.T) {
	cases := []struct{ name, metadata, image string }{
		{"external path", `{"ok":true,"result":{"file_path":"https://evil.test/a.jpg","file_size":4}}`, ""},
		{"traversal", `{"ok":true,"result":{"file_path":"photos/../secret.jpg","file_size":4}}`, ""},
		{"oversize", `{"ok":true,"result":{"file_path":"photos/a.jpg","file_size":5242881}}`, ""},
		{"wrong type", `{"ok":true,"result":{"file_path":"photos/a.jpg","file_size":4}}`, "text"},
		{"size mismatch", `{"ok":true,"result":{"file_path":"photos/a.jpg","file_size":5}}`, "\xff\xd8\xff\xd9"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			client := &http.Client{Transport: photoRoundTrip(func(r *http.Request) (*http.Response, error) {
				calls++
				if r.URL.Host != "api.telegram.org" {
					t.Fatal("unexpected host")
				}
				body := tc.metadata
				if calls == 2 {
					body = tc.image
				}
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
			})}
			if _, _, err := fetchTelegramPhoto(context.Background(), client, "fake-token", "file"); err == nil {
				t.Fatal("accepted unsafe response")
			}
			if (tc.name == "external path" || tc.name == "traversal" || tc.name == "oversize") && calls != 1 {
				t.Fatal("unexpected download")
			}
		})
	}
}
