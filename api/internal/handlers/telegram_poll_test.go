package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/openmentor-io/openmentor/api/test/dbtest"
)

func TestTelegramPollRecognizesOnlyVacancyChannelPosts(t *testing.T) {
	cases := []struct {
		input string
		want  bool
	}{
		{`{"channel_post":{"message_id":1,"chat":{"id":-1001,"type":"channel"},"text":"Analyst\nКакие задачи ждут?\nWork"}}`, true},
		{`{"channel_post":{"message_id":1,"chat":{"id":-1002,"type":"channel"},"text":"Analyst\nКакие задачи ждут?\nWork"}}`, false},
		{`{"channel_post":{"message_id":1,"chat":{"id":-1001,"type":"channel"},"from":{"is_bot":true},"text":"Analyst\nКакие задачи ждут?\nWork"}}`, false},
		{`{"channel_post":{"message_id":1,"chat":{"id":-1001,"type":"channel"},"text":"Hello everyone"}}`, false},
		{`{"message":{"message_id":1,"chat":{"id":-1001,"type":"channel"},"text":"Какие задачи ждут?"}}`, false},
	}
	for _, tc := range cases {
		var u telegramUpdate
		if err := json.Unmarshal([]byte(tc.input), &u); err != nil {
			t.Fatal(err)
		}
		if got := u.recognized(-1001); got != tc.want {
			t.Errorf("%s got %v", tc.input, got)
		}
	}
}

func TestTelegramPollDurableRecovery(t *testing.T) {
	pool := dbtest.Pool(t)
	ctx := context.Background()
	key := "test-bot"
	channel := int64(-100999)
	t.Cleanup(func() {
		pool.Exec(ctx, `DELETE FROM telegram_vacancy_offsets WHERE bot_key=$1`, key)
		pool.Exec(ctx, `DELETE FROM vacancies WHERE id IN (SELECT vacancy_id FROM telegram_vacancy_sources WHERE channel_id=$1)`, channel)
	})
	var offsets []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/botfake/getUpdates" {
			t.Errorf("wrong path")
			w.WriteHeader(404)
			return
		}
		r.ParseForm()
		offsets = append(offsets, r.Form.Get("offset"))
		w.Header().Set("Content-Type", "application/json")
		if r.Form.Get("offset") == "0" {
			fmt.Fprint(w, `{"ok":true,"result":[{"update_id":10,"channel_post":{"message_id":7,"chat":{"id":-100999},"caption":"Analyst\nКакие задачи ждут?\nWork\nПодробнее","caption_entities":[{"type":"text_link","offset":32,"length":9,"url":"https://example.test/job"}],"photo":[{"file_id":"pic"}]}}]}`)
		} else {
			fmt.Fprint(w, `{"ok":true,"result":[]}`)
		}
	}))
	defer srv.Close()
	p := TelegramPoller{Pool: pool, Token: "fake", ChannelID: channel, BaseURL: srv.URL, Client: srv.Client()}
	if _, err := pool.Exec(ctx, `CREATE FUNCTION test_reject_telegram_offset() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test'; END $$; CREATE TRIGGER test_reject_offset BEFORE INSERT ON telegram_vacancy_offsets FOR EACH ROW EXECUTE FUNCTION test_reject_telegram_offset()`); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, `DROP TRIGGER IF EXISTS test_reject_offset ON telegram_vacancy_offsets; DROP FUNCTION IF EXISTS test_reject_telegram_offset()`)
	})
	if err := p.pollOnce(ctx, key); err == nil {
		t.Fatal("expected offset save failure")
	}
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM telegram_vacancy_sources WHERE channel_id=$1`, channel).Scan(&n); err != nil || n != 1 {
		t.Fatalf("saved import count=%d err=%v", n, err)
	}
	if _, err := pool.Exec(ctx, `DROP TRIGGER test_reject_offset ON telegram_vacancy_offsets; DROP FUNCTION test_reject_telegram_offset()`); err != nil {
		t.Fatal(err)
	}
	// Simulate restart: replay same update, then the next request confirms persisted offset.
	p = TelegramPoller{Pool: pool, Token: "fake", ChannelID: channel, BaseURL: srv.URL, Client: srv.Client()}
	if err := p.pollOnce(ctx, key); err != nil {
		t.Fatal(err)
	}
	if err := p.pollOnce(ctx, key); err != nil {
		t.Fatal(err)
	}
	if strings.Join(offsets, ",") != "0,0,11" {
		t.Fatalf("offsets %v", offsets)
	}
	var raw, photo, source string
	if err := pool.QueryRow(ctx, `SELECT raw_text,photo_ids::text,source_url FROM telegram_vacancy_sources WHERE channel_id=$1`, channel).Scan(&raw, &photo, &source); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(raw, "Analyst") || !strings.Contains(photo, "pic") || source != "https://example.test/job" {
		t.Fatalf("source not preserved raw=%q photo=%q source=%q", raw, photo, source)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM telegram_vacancy_sources WHERE channel_id=$1`, channel).Scan(&n); err != nil || n != 1 {
		t.Fatalf("duplicate count %d %v", n, err)
	}
}

func TestTelegramPollerRunStopsAndResumes(t *testing.T) {
	pool := dbtest.Pool(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	seen := make(chan string, 8)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.ParseForm()
		seen <- r.Form.Get("offset")
		if r.Form.Get("offset") == "0" {
			fmt.Fprint(w, `{"ok":true,"result":[{"update_id":99,"channel_post":{"message_id":44,"chat":{"id":-100997},"text":"Engineer\nКакие задачи ждут?\nBuild"}}]}`)
		} else {
			<-r.Context().Done()
		}
	}))
	defer srv.Close()
	p := TelegramPoller{Pool: pool, Token: "fake-run-token", ChannelID: -100997, BaseURL: srv.URL, Client: srv.Client()}
	sum := sha256.Sum256([]byte(p.Token))
	key := hex.EncodeToString(sum[:])
	t.Cleanup(func() {
		pool.Exec(context.Background(), `DELETE FROM telegram_vacancy_offsets WHERE bot_key=$1`, key)
		pool.Exec(context.Background(), `DELETE FROM vacancies WHERE id IN (SELECT vacancy_id FROM telegram_vacancy_sources WHERE channel_id=-100997)`)
	})
	done := make(chan error, 1)
	go func() { done <- p.Run(ctx) }()
	for _, want := range []string{"0", "100"} {
		select {
		case got := <-seen:
			if got != want {
				t.Fatalf("offset %s expected %s", got, want)
			}
		case <-time.After(5 * time.Second):
			t.Fatal("poller did not advance")
		}
	}
	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("poller did not stop")
	}
	var n int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM telegram_vacancy_sources WHERE channel_id=-100997`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("count %d error %v", n, err)
	}
}
