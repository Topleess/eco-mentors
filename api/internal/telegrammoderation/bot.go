// Package telegrammoderation is an unwired protocol core, not a Telegram client.
package telegrammoderation

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"strings"
	"sync"
	"time"
)

var ErrRejected = errors.New("moderation request rejected")

type Decision struct{ ModeratorID, MentorID, Action, Comment string }

// Backend must resolve a verified Telegram binding to a currently authorized moderator.
// Apply must atomically check authorization and pending status and perform the transition;
// it must not construct a browser session. Side effects must be gated on the transition.
type Backend interface {
	Authorized(context.Context, int64) (string, bool, error)
	Apply(context.Context, Decision) error
}
type Message struct {
	ChatID                   int64
	MentorID                 string
	Approve, Decline, Return string
}
type Transport interface {
	Send(context.Context, Message) error
}
type Update struct {
	UserID, ChatID int64
	Private        bool
}
type ticket struct {
	user                      int64
	moderator, mentor, action string
	expiry                    time.Time
	group                     string
}
type Bot struct {
	backend   Backend
	transport Transport
	now       func() time.Time
	mu        sync.Mutex
	tickets   map[string]ticket
	pending   map[int64]ticket
}

func New(b Backend, t Transport, now func() time.Time) *Bot {
	return &Bot{backend: b, transport: t, now: now, tickets: make(map[string]ticket), pending: make(map[int64]ticket)}
}
func token() (string, error) {
	var b [24]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}

//nolint:gocyclo // Notification validation and delivery remain in sequence.
func (b *Bot) Notify(ctx context.Context, user int64, mentor string, ttl time.Duration) error {
	if user <= 0 || mentor == "" || ttl <= 0 {
		return ErrRejected
	}
	moderator, ok, err := b.backend.Authorized(ctx, user)
	if err != nil {
		return err
	}
	if !ok || moderator == "" {
		return ErrRejected
	}
	group, err := token()
	if err != nil {
		return err
	}
	msg := Message{ChatID: user, MentorID: mentor}
	keys := []*string{&msg.Approve, &msg.Decline, &msg.Return}
	actions := []string{"approve", "decline", "return"}
	entries := make(map[string]ticket)
	for i := range keys {
		k, e := token()
		if e != nil {
			return e
		}
		*keys[i] = k
		entries[k] = ticket{user: user, moderator: moderator, mentor: mentor, action: actions[i], expiry: b.now().Add(ttl), group: group}
	}
	b.mu.Lock()
	// Expired capability and comment state is never actionable; reclaim it on
	// notification rather than retaining every issued ticket indefinitely.
	now := b.now()
	for k, v := range b.tickets {
		if !now.Before(v.expiry) {
			delete(b.tickets, k)
		}
	}
	for user, v := range b.pending {
		if !now.Before(v.expiry) {
			delete(b.pending, user)
		}
	}
	for k, v := range entries {
		b.tickets[k] = v
	}
	b.mu.Unlock()
	if err = b.transport.Send(ctx, msg); err != nil {
		b.mu.Lock()
		for k := range entries {
			delete(b.tickets, k)
		}
		b.mu.Unlock()
		return err
	}
	return nil
}
func (b *Bot) authorize(ctx context.Context, u Update) (string, error) {
	if !u.Private || u.UserID <= 0 || u.ChatID != u.UserID {
		return "", ErrRejected
	}
	m, ok, err := b.backend.Authorized(ctx, u.UserID)
	if err != nil {
		return "", err
	}
	if !ok || m == "" {
		return "", ErrRejected
	}
	return m, nil
}
func (b *Bot) Callback(ctx context.Context, u Update, key string) error {
	moderator, err := b.authorize(ctx, u)
	if err != nil {
		return err
	}
	b.mu.Lock()
	t, ok := b.tickets[key]
	if !ok || t.user != u.UserID || t.moderator != moderator || !b.now().Before(t.expiry) {
		b.mu.Unlock()
		return ErrRejected
	}
	for k, v := range b.tickets {
		if v.group == t.group {
			delete(b.tickets, k)
		}
	}
	// A new decision supersedes any earlier pending comment. Otherwise the next
	// ordinary message can silently act on a different application.
	delete(b.pending, u.UserID)
	if t.action == "return" {
		b.pending[u.UserID] = t
		b.mu.Unlock()
		return nil
	}
	b.mu.Unlock()
	return b.backend.Apply(ctx, Decision{ModeratorID: moderator, MentorID: t.mentor, Action: t.action})
}
func (b *Bot) Comment(ctx context.Context, u Update, text string) error {
	moderator, err := b.authorize(ctx, u)
	if err != nil {
		return err
	}
	if strings.TrimSpace(text) == "" || len(text) > 2000 {
		return ErrRejected
	}
	b.mu.Lock()
	t, ok := b.pending[u.UserID]
	if !ok || t.moderator != moderator || !b.now().Before(t.expiry) {
		b.mu.Unlock()
		return ErrRejected
	}
	delete(b.pending, u.UserID)
	b.mu.Unlock()
	return b.backend.Apply(ctx, Decision{ModeratorID: moderator, MentorID: t.mentor, Action: t.action, Comment: text})
}
