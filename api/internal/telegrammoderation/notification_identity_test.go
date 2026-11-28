package telegrammoderation

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestNotificationIdentifiesApplication(t *testing.T) {
	var body string
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		b, _ := io.ReadAll(r.Body)
		body = string(b)
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"ok":true}`)), Header: make(http.Header)}, nil
	})}
	transport, err := NewTelegramTransport("secret", client)
	if err != nil {
		t.Fatal(err)
	}
	bot := New(&fakeBackend{}, transport, time.Now)
	if err := bot.Notify(context.Background(), 42, "mentor-123", time.Minute); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(body, "mentor-123") {
		t.Fatalf("notification does not identify the application: %s", body)
	}
}
