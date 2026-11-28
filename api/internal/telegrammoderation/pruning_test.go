package telegrammoderation

import (
	"context"
	"testing"
	"time"
)

func TestExpiredTicketsArePrunedWhenNotifying(t *testing.T) {
	now := time.Now()
	b := New(&fakeBackend{}, &fakeTransport{}, func() time.Time { return now })
	if err := b.Notify(context.Background(), 42, "first", time.Second); err != nil {
		t.Fatal(err)
	}
	now = now.Add(time.Second)
	if err := b.Notify(context.Background(), 42, "second", time.Minute); err != nil {
		t.Fatal(err)
	}
	if len(b.tickets) != 3 {
		t.Fatalf("expected only new tickets, got %d", len(b.tickets))
	}
}
