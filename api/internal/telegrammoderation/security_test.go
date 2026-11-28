package telegrammoderation

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestPrivateAuthorizationExpirationAndComment(t *testing.T) {
	ctx := context.Background()
	f := &fakeBackend{}
	tx := &fakeTransport{}
	now := time.Now()
	b := New(f, tx, func() time.Time { return now })
	if err := b.Notify(ctx, 99, "m", time.Minute); err == nil {
		t.Fatal("unauthorized notification")
	}
	if err := b.Notify(ctx, 42, "m", time.Minute); err != nil {
		t.Fatal(err)
	}
	msg := tx.messages[0]
	for _, u := range []Update{{UserID: 42, ChatID: 42}, {UserID: 42, ChatID: 99, Private: true}, {UserID: 99, ChatID: 99, Private: true}} {
		if b.Callback(ctx, u, msg.Return) == nil {
			t.Fatal("accepted invalid identity or chat")
		}
	}
	u := Update{UserID: 42, ChatID: 42, Private: true}
	if err := b.Callback(ctx, u, msg.Return); err != nil {
		t.Fatal(err)
	}
	if b.Callback(ctx, u, msg.Approve) == nil {
		t.Fatal("sibling callback accepted")
	}
	if b.Comment(ctx, u, strings.Repeat(" ", 3)) == nil {
		t.Fatal("blank comment accepted")
	}
	if err := b.Comment(ctx, u, "Please add experience"); err != nil {
		t.Fatal(err)
	}
	if len(f.calls) != 1 || f.calls[0].Action != "return" || f.calls[0].Comment != "Please add experience" {
		t.Fatalf("unexpected decision: %+v", f.calls)
	}
	if b.Comment(ctx, u, "again") == nil {
		t.Fatal("comment replay accepted")
	}
	if err := b.Notify(ctx, 42, "m2", time.Minute); err != nil {
		t.Fatal(err)
	}
	now = now.Add(time.Minute)
	if b.Callback(ctx, u, tx.messages[1].Decline) == nil {
		t.Fatal("expired callback accepted")
	}
}
func TestConcurrentReplay(t *testing.T) {
	ctx := context.Background()
	f := &fakeBackend{}
	tx := &fakeTransport{}
	b := New(f, tx, time.Now)
	if err := b.Notify(ctx, 42, "m", time.Minute); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = b.Callback(ctx, Update{UserID: 42, ChatID: 42, Private: true}, tx.messages[0].Approve)
		}()
	}
	wg.Wait()
	if len(f.calls) != 1 {
		t.Fatalf("got %d decisions", len(f.calls))
	}
}
