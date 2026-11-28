package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openmentor-io/openmentor/api/internal/telegramvacancy/parser"
)

type telegramUpdate struct {
	UpdateID    int64 `json:"update_id"`
	ChannelPost *struct {
		telegramImportMessage
		From *struct {
			IsBot bool `json:"is_bot"`
		} `json:"from"`
	} `json:"channel_post"`
}

func (u telegramUpdate) recognized(channel int64) bool {
	m := u.ChannelPost
	if m == nil || m.Chat.ID != channel || m.MessageID <= 0 || (m.From != nil && m.From.IsBot) {
		return false
	}
	v := parser.Parse(m.Message)
	return v.Heading != "" && (v.Tasks != "" || v.Requirements != "" || v.Benefits != "")
}

type TelegramPoller struct {
	Pool              *pgxpool.Pool
	Token             string
	ChannelID         int64
	OutboundChannelID int64
	Client            *http.Client
	BaseURL           string
	OnRetry           func()
}

// Run holds a database advisory lock for the bot's entire lifetime. Only a
// committed offset is sent to Telegram, so failed imports are redelivered.
func (p *TelegramPoller) Run(ctx context.Context) error {
	if p.Pool == nil || p.Token == "" || p.ChannelID >= 0 {
		return errors.New("invalid Telegram intake configuration")
	}
	sum := sha256.Sum256([]byte(p.Token))
	key := hex.EncodeToString(sum[:])
	conn, err := p.Pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	var locked bool
	if err := conn.QueryRow(ctx, `SELECT pg_try_advisory_lock(hashtextextended($1, 0))`, "telegram-poll:"+key).Scan(&locked); err != nil {
		return err
	}
	if !locked {
		return errors.New("Telegram poller already running") //nolint:staticcheck // Preserve existing error text.
	}
	defer func() {
		_, _ = conn.Exec(context.Background(), `SELECT pg_advisory_unlock(hashtextextended($1, 0))`, "telegram-poll:"+key) //nolint:errcheck // Unlock is best effort during cleanup.
	}()
	for ctx.Err() == nil {
		if err = p.pollOnce(ctx, key); err != nil {
			if ctx.Err() == nil && p.OnRetry != nil {
				p.OnRetry()
			}
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(3 * time.Second):
			}
		}
	}
	return nil
}

//nolint:gocyclo // Polling validation and offset handling form one sequential flow.
func (p *TelegramPoller) pollOnce(ctx context.Context, key string) error {
	var offset int64
	err := p.Pool.QueryRow(ctx, `SELECT next_update_id FROM telegram_vacancy_offsets WHERE bot_key=$1`, key).Scan(&offset)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	base := p.BaseURL
	if base == "" {
		base = "https://api.telegram.org"
	}
	endpoint := strings.TrimRight(base, "/") + "/bot" + p.Token + "/getUpdates"
	values := url.Values{"offset": {strconv.FormatInt(offset, 10)}, "timeout": {"25"}, "allowed_updates": {`["channel_post"]`}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(values.Encode()))
	if err != nil {
		return errors.New("invalid Telegram endpoint")
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := p.Client
	if client == nil {
		client = &http.Client{Timeout: 35 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return errors.New("Telegram request failed") //nolint:staticcheck // Preserve existing error text.
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return errors.New("Telegram request rejected") //nolint:staticcheck // Preserve existing error text.
	}
	var result struct {
		OK     bool             `json:"ok"`
		Result []telegramUpdate `json:"result"`
	}
	if err = json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&result); err != nil || !result.OK {
		return errors.New("invalid Telegram response")
	}
	for _, u := range result.Result {
		if u.UpdateID < offset {
			continue
		}
		if u.UpdateID < 0 || u.UpdateID == int64(^uint64(0)>>1) {
			return errors.New("invalid Telegram update")
		}
		if u.recognized(p.ChannelID) {
			if err := p.processRecognized(ctx, u); err != nil {
				return err
			}
		}
		offset = u.UpdateID + 1
		if _, err = p.Pool.Exec(ctx, `INSERT INTO telegram_vacancy_offsets(bot_key,next_update_id) VALUES($1,$2) ON CONFLICT(bot_key) DO UPDATE SET next_update_id=GREATEST(telegram_vacancy_offsets.next_update_id,EXCLUDED.next_update_id)`, key, offset); err != nil {
			return err
		}
	}
	return nil
}

// processRecognized keeps the publication lock until import finishes. Pending
// reservations have unknown message IDs; never advance past a possible match.
func (p *TelegramPoller) processRecognized(ctx context.Context, u telegramUpdate) error {
	if p.OutboundChannelID != p.ChannelID {
		_, _, err := importTelegramMessage(ctx, p.Pool, u.ChannelPost.telegramImportMessage)
		return err
	}
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background()) //nolint:errcheck // Best-effort rollback after commit or failure.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended('telegram-vacancy-publication',0))`); err != nil {
		return err
	}
	var own, pending bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM vacancy_telegram_publications WHERE message_id=$1), EXISTS(SELECT 1 FROM vacancy_telegram_publications WHERE message_id IS NULL)`, u.ChannelPost.MessageID).Scan(&own, &pending); err != nil {
		return err
	}
	if !own && pending {
		return errors.New("Telegram intake paused: publication result unknown") //nolint:staticcheck // Preserve existing error text.
	}
	if !own {
		if _, _, err = importTelegramMessageTx(ctx, tx, u.ChannelPost.telegramImportMessage); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// TelegramPollerFromEnv is intentionally opt-in; errors never include credentials.
func TelegramPollerFromEnv(pool *pgxpool.Pool, enabled, token, channel string) (*TelegramPoller, error) {
	if enabled == "" || enabled == "false" {
		return nil, nil
	}
	if enabled != "true" {
		return nil, errors.New("TELEGRAM_VACANCY_INTAKE_ENABLED must be true or false")
	}
	id, err := strconv.ParseInt(channel, 10, 64)
	if err != nil || id >= 0 || strings.TrimSpace(token) == "" {
		return nil, fmt.Errorf("Telegram intake requires a token and negative numeric channel ID") //nolint:staticcheck // Preserve existing error text.
	}
	return &TelegramPoller{Pool: pool, Token: token, ChannelID: id}, nil
}
