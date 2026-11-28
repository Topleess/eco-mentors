package telegrammoderation

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestWebhookRequiresSecretAndProcessesPrivateCallbackOnce(t *testing.T) {
	backend := &fakeBackend{}
	transport := &fakeTransport{}
	bot := New(backend, transport, time.Now)
	if err := bot.Notify(context.Background(), 42, "mentor-1", time.Minute); err != nil {
		t.Fatal(err)
	}
	handler, err := NewWebhook(bot, "test-secret")
	if err != nil {
		t.Fatal(err)
	}
	body := []byte(`{"update_id":1,"callback_query":{"id":"cb","from":{"id":42},"message":{"chat":{"id":42,"type":"private"}},"data":"` + transport.messages[0].Approve + `"}}`)
	send := func(secret string) int {
		req := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(body))
		req.Header.Set("X-Telegram-Bot-Api-Secret-Token", secret)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		return w.Code
	}
	if code := send("wrong"); code != http.StatusUnauthorized {
		t.Fatalf("wrong secret: %d", code)
	}
	if len(backend.calls) != 0 {
		t.Fatal("unauthenticated action applied")
	}
	if code := send("test-secret"); code != http.StatusOK {
		t.Fatalf("valid request: %d", code)
	}
	if code := send("test-secret"); code != http.StatusOK {
		t.Fatalf("replay response: %d", code)
	}
	if len(backend.calls) != 1 {
		t.Fatalf("applied %d times", len(backend.calls))
	}
}
