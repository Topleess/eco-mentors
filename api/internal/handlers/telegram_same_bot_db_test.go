package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openmentor-io/openmentor/api/test/dbtest"
)

func TestTelegramSameChannelPublicationRace(t *testing.T) {
	pool := dbtest.Pool(t)
	ctx := context.Background()
	suffix := uuid.NewString()
	var industry, city, id string
	if err := pool.QueryRow(ctx, `INSERT INTO vacancy_industries(slug,name) VALUES($1,'test') RETURNING id`, "i-"+suffix).Scan(&industry); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO vacancy_cities(slug,name) VALUES($1,'test') RETURNING id`, "c-"+suffix).Scan(&city); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO vacancies(slug,industry_id,city_id,status,payload) VALUES($1,$2,$3,'published',$4) RETURNING id`, "v-"+suffix, industry, city, `{"title":"Engineer","company":"Acme","requirements":["Go"]}`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	const channel int64 = -10087654
	key := "race-" + suffix
	t.Cleanup(func() {
		pool.Exec(ctx, `DELETE FROM telegram_vacancy_offsets WHERE bot_key=$1`, key)
		pool.Exec(ctx, `DELETE FROM vacancies WHERE id IN (SELECT vacancy_id FROM telegram_vacancy_sources WHERE channel_id=$1)`, channel)
		pool.Exec(ctx, `DELETE FROM vacancy_telegram_publications WHERE vacancy_id=$1`, id)
		pool.Exec(ctx, `DELETE FROM vacancies WHERE id=$1`, id)
		pool.Exec(ctx, `DELETE FROM vacancy_industries WHERE id=$1`, industry)
		pool.Exec(ctx, `DELETE FROM vacancy_cities WHERE id=$1`, city)
	})
	entered, release := make(chan struct{}), make(chan struct{})
	sendClient := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		close(entered)
		<-release
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"ok":true,"result":{"message_id":42}}`))}, nil
	})}
	var external atomic.Bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if external.Load() {
			fmt.Fprint(w, `{"ok":true,"result":[{"update_id":11,"channel_post":{"message_id":43,"chat":{"id":-10087654},"text":"Analyst\nКакие задачи ждут?\nWork"}}]}`)
			return
		}
		fmt.Fprint(w, `{"ok":true,"result":[{"update_id":10,"channel_post":{"message_id":42,"chat":{"id":-10087654},"text":"Engineer\nКакие задачи ждут?\nBuild"}}]}`)
	}))
	defer srv.Close()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/:id", func(c *gin.Context) {
		telegramPublish(c, pool, TelegramVacancyOptions{Token: "fake", ChatID: "-10087654", Client: sendClient})
	})
	published := make(chan int, 1)
	go func() {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/"+id, strings.NewReader(`{"version":1}`))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)
		published <- w.Code
	}()
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("send did not start")
	}
	p := TelegramPoller{Pool: pool, Token: "fake", ChannelID: channel, OutboundChannelID: channel, BaseURL: srv.URL, Client: srv.Client()}
	done := make(chan error, 1)
	go func() { done <- p.pollOnce(ctx, key) }()
	select {
	case err := <-done:
		close(release)
		t.Fatalf("poll completed before send response: %v", err)
	case <-time.After(300 * time.Millisecond):
	}
	close(release)
	if code := <-published; code != 200 {
		t.Fatalf("publish status %d", code)
	}
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM telegram_vacancy_sources WHERE channel_id=$1`, channel).Scan(&n); err != nil || n != 0 {
		t.Fatalf("self imported count=%d err=%v", n, err)
	}
	// Fake Telegram accepts the post but loses the response.
	if _, err := pool.Exec(ctx, `DELETE FROM vacancy_telegram_publications WHERE vacancy_id=$1`, id); err != nil {
		t.Fatal(err)
	}
	sendClient.Transport = roundTripFunc(func(*http.Request) (*http.Response, error) { return nil, io.ErrUnexpectedEOF })
	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/"+id, strings.NewReader(`{"version":1}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	if w.Code != 502 {
		t.Fatalf("unknown send status %d", w.Code)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM telegram_vacancy_offsets WHERE bot_key=$1`, key); err != nil {
		t.Fatal(err)
	}
	if err := p.pollOnce(ctx, key); err == nil {
		t.Fatal("unknown publication must pause intake")
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM telegram_vacancy_sources WHERE channel_id=$1`, channel).Scan(&n); err != nil || n != 0 {
		t.Fatalf("ambiguous post imported: %d %v", n, err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM telegram_vacancy_offsets WHERE bot_key=$1`, key).Scan(&n); err != nil || n != 0 {
		t.Fatalf("ambiguous post acknowledged: %d %v", n, err)
	}
	if _, err := pool.Exec(ctx, `UPDATE vacancy_telegram_publications SET message_id=42 WHERE vacancy_id=$1`, id); err != nil {
		t.Fatal(err)
	}
	if err := p.pollOnce(ctx, key); err != nil {
		t.Fatalf("resolved publication: %v", err)
	}
	external.Store(true)
	if err := p.pollOnce(ctx, key); err != nil {
		t.Fatalf("external post: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM telegram_vacancy_sources WHERE channel_id=$1 AND message_id=43`, channel).Scan(&n); err != nil || n != 1 {
		t.Fatalf("external import count=%d err=%v", n, err)
	}
}
