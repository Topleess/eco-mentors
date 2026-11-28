package telegrammoderation

import (
	"context"
	"testing"
	"time"
)

type fakeBackend struct{ calls []Decision }

func (f *fakeBackend) Authorized(_ context.Context, id int64) (string, bool, error) {
	if id == 42 {
		return "moderator", true, nil
	}
	return "", false, nil
}
func (f *fakeBackend) Apply(_ context.Context, d Decision) error {
	f.calls = append(f.calls, d)
	return nil
}

type fakeTransport struct{ messages []Message }

func (f *fakeTransport) Send(_ context.Context, m Message) error {
	f.messages = append(f.messages, m)
	return nil
}

func TestNotificationAndSingleUseDecision(t *testing.T) {
	ctx := context.Background()
	backend := &fakeBackend{}
	transport := &fakeTransport{}
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	bot := New(backend, transport, func() time.Time { return now })
	if err := bot.Notify(ctx, 42, "mentor-1", time.Minute); err != nil {
		t.Fatal(err)
	}
	token := transport.messages[0].Approve
	if err := bot.Callback(ctx, Update{UserID: 42, ChatID: 42, Private: true}, token); err != nil {
		t.Fatal(err)
	}
	if len(backend.calls) != 1 || backend.calls[0].MentorID != "mentor-1" || backend.calls[0].ModeratorID != "moderator" || backend.calls[0].Action != "approve" {
		t.Fatalf("unexpected decisions: %+v", backend.calls)
	}
	if err := bot.Callback(ctx, Update{UserID: 42, ChatID: 42, Private: true}, token); err == nil {
		t.Fatal("replay accepted")
	}
}
