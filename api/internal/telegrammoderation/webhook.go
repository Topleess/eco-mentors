package telegrammoderation

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

// NewWebhook authenticates callback updates from Telegram. This handler is not
// registered automatically: provisioning a secret and routing it are explicit
// deployment decisions. Text replies are intentionally not processed until
// durable update deduplication is available.
func NewWebhook(bot *Bot, secret string) (http.Handler, error) {
	if bot == nil || secret == "" || len(secret) > 256 || strings.Trim(secret, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-") != "" {
		return nil, ErrRejected
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		supplied := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")
		if subtle.ConstantTimeCompare([]byte(supplied), []byte(secret)) != 1 {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		defer r.Body.Close()
		var update struct {
			Callback *struct {
				From struct {
					ID int64 `json:"id"`
				} `json:"from"`
				Message *struct {
					Chat struct {
						ID   int64  `json:"id"`
						Type string `json:"type"`
					} `json:"chat"`
				} `json:"message"`
				Data string `json:"data"`
			} `json:"callback_query"`
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10))
		if err := dec.Decode(&update); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if c := update.Callback; c != nil && c.Message != nil {
			err := bot.Callback(r.Context(), Update{UserID: c.From.ID, ChatID: c.Message.Chat.ID, Private: c.Message.Chat.Type == "private"}, c.Data)
			if err != nil && !errors.Is(err, ErrRejected) {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
		}
		w.WriteHeader(http.StatusOK)
	}), nil
}
