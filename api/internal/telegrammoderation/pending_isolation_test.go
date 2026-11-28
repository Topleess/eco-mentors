package telegrammoderation

import (
	"context"
	"testing"
	"time"
)

func TestNewDecisionCancelsOutstandingReturnComment(t *testing.T) {
	ctx := context.Background()
	backend := &fakeBackend{}
	transport := &fakeTransport{}
	bot := New(backend, transport, time.Now)
	u := Update{UserID: 42, ChatID: 42, Private: true}
	if err := bot.Notify(ctx, 42, "first", time.Minute); err != nil {
		t.Fatal(err)
	}
	if err := bot.Callback(ctx, u, transport.messages[0].Return); err != nil {
		t.Fatal(err)
	}
	if err := bot.Notify(ctx, 42, "second", time.Minute); err != nil {
		t.Fatal(err)
	}
	if err := bot.Callback(ctx, u, transport.messages[1].Approve); err != nil {
		t.Fatal(err)
	}
	if err := bot.Comment(ctx, u, "unrelated reply"); err == nil {
		t.Fatal("stale comment applied to previous application")
	}
	if len(backend.calls) != 1 || backend.calls[0].MentorID != "second" {
		t.Fatalf("unexpected decisions: %+v", backend.calls)
	}
}
