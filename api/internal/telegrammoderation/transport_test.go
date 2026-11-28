package telegrammoderation

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestTelegramTransportSendsPrivateButtons(t *testing.T) {
	called := false
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		called = true
		if r.URL.Host != "api.telegram.org" || r.URL.Path != "/botsecret/sendMessage" || r.Method != http.MethodPost {
			t.Fatal("incorrect request")
		}
		b, _ := io.ReadAll(r.Body)
		for _, s := range []string{`"chat_id":42`, `"callback_data":"approve-token"`, `"callback_data":"decline-token"`} {
			if !strings.Contains(string(b), s) {
				t.Fatalf("missing %s", s)
			}
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"ok":true}`)), Header: make(http.Header)}, nil
	})}
	transport, err := NewTelegramTransport("secret", client)
	if err != nil {
		t.Fatal(err)
	}
	if err := transport.Send(context.Background(), Message{ChatID: 42, Approve: "approve-token", Decline: "decline-token", Return: "return-token"}); err != nil {
		t.Fatal(err)
	}
	if !called {
		t.Fatal("no request")
	}
}
