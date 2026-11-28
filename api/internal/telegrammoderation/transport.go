package telegrammoderation

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
)

var errDelivery = errors.New("telegram delivery failed")

type TelegramTransport struct {
	token  string
	client *http.Client
}

// NewTelegramTransport creates an opt-in client. Errors intentionally omit
// request URLs and response bodies because they can contain credentials or PII.
func NewTelegramTransport(token string, client *http.Client) (*TelegramTransport, error) {
	if token == "" || len(token) > 256 || strings.Trim(token, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_:-") != "" {
		return nil, ErrRejected
	}
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return &TelegramTransport{token: token, client: client}, nil
}
func (t *TelegramTransport) Send(ctx context.Context, m Message) error {
	if m.ChatID <= 0 || m.Approve == "" || m.Decline == "" {
		return ErrRejected
	}
	type button struct {
		Text string `json:"text"`
		Data string `json:"callback_data"`
	}
	payload := struct {
		ChatID      int64  `json:"chat_id"`
		Text        string `json:"text"`
		ReplyMarkup struct {
			InlineKeyboard [][]button `json:"inline_keyboard"`
		} `json:"reply_markup"`
	}{ChatID: m.ChatID, Text: "A mentor profile is awaiting moderation. Review it in the moderation dashboard before deciding."}
	if m.MentorID != "" {
		payload.Text += " Application ID: " + m.MentorID
	}
	// Return is deliberately absent until comment replies have durable replay protection.
	payload.ReplyMarkup.InlineKeyboard = [][]button{{{Text: "Approve", Data: m.Approve}, {Text: "Decline", Data: m.Decline}}}
	body, err := json.Marshal(payload)
	if err != nil {
		return errDelivery
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.telegram.org/bot"+t.token+"/sendMessage", bytes.NewReader(body))
	if err != nil {
		return errDelivery
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := t.client.Do(req)
	if err != nil {
		return errDelivery
	}
	defer resp.Body.Close()
	var result struct {
		OK bool `json:"ok"`
	}
	if resp.StatusCode != http.StatusOK || json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&result) != nil || !result.OK {
		return errDelivery
	}
	return nil
}
