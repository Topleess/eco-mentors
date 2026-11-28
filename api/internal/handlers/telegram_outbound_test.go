package handlers

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestTelegramSendUsesPlainTextAndReturnsMessageID(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.String() != "https://api.telegram.org/bottest-token/sendMessage" {
			t.Fatalf("unexpected URL: %s", r.URL)
		}
		b, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(b), `"chat_id":"-123"`) || !strings.Contains(string(b), `"text":"hello"`) || strings.Contains(string(b), "parse_mode") {
			t.Fatalf("unexpected body %s", b)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"ok":true,"result":{"message_id":42}}`)), Header: make(http.Header)}, nil
	})}
	id, err := sendTelegramVacancy(context.Background(), client, "test-token", "-123", "hello")
	if err != nil || id != 42 {
		t.Fatalf("got %d %v", id, err)
	}
}
