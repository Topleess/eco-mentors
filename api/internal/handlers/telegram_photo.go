package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

const maxTelegramPhoto = 5 << 20

var telegramPhotoPath = regexp.MustCompile(`^photos/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$`)

// The only network destinations are Telegram's fixed HTTPS host. Never return
// upstream errors, paths, or credentials to the caller.
//
//nolint:gocyclo // Fetch validation and bounded response handling are kept together.
func fetchTelegramPhoto(ctx context.Context, client *http.Client, token, id string) ([]byte, string, error) {
	fail := errors.New("photo unavailable")
	if token == "" || id == "" || len(id) > 512 {
		return nil, "", fail
	}
	clientCopy := *client
	clientCopy.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	get := func(target string, limit int64) ([]byte, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, http.NoBody)
		if err != nil {
			return nil, fail
		}
		resp, err := clientCopy.Do(req)
		if err != nil {
			return nil, fail
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK || resp.ContentLength > limit {
			return nil, fail
		}
		b, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
		if err != nil || int64(len(b)) > limit {
			return nil, fail
		}
		return b, nil
	}
	metadata, err := get("https://api.telegram.org/bot"+url.PathEscape(token)+"/getFile?file_id="+url.QueryEscape(id), 64<<10)
	if err != nil {
		return nil, "", fail
	}
	var result struct {
		OK     bool `json:"ok"`
		Result struct {
			FilePath string `json:"file_path"`
			FileSize int64  `json:"file_size"`
		} `json:"result"`
	}
	if json.Unmarshal(metadata, &result) != nil || !result.OK || result.Result.FileSize <= 0 || result.Result.FileSize > maxTelegramPhoto || !telegramPhotoPath.MatchString(result.Result.FilePath) {
		return nil, "", fail
	}
	b, err := get("https://api.telegram.org/file/bot"+url.PathEscape(token)+"/"+result.Result.FilePath, maxTelegramPhoto)
	if err != nil || int64(len(b)) != result.Result.FileSize {
		return nil, "", fail
	}
	typ := http.DetectContentType(b)
	if typ != "image/jpeg" && typ != "image/png" && typ != "image/webp" {
		return nil, "", fail
	}
	return b, typ, nil
}

func telegramPhoto(c *gin.Context, pool *pgxpool.Pool, opts TelegramVacancyOptions) {
	c.Header("Cache-Control", "no-store")
	c.Header("X-Content-Type-Options", "nosniff")
	index, err := strconv.Atoi(c.Param("index"))
	if err != nil || index < 0 || index > 100 {
		c.Status(404)
		return
	}
	var ids []byte
	if err = pool.QueryRow(c.Request.Context(), `SELECT photo_ids FROM telegram_vacancy_sources WHERE vacancy_id=$1`, c.Param("id")).Scan(&ids); err != nil {
		c.Status(404)
		return
	}
	var photos []string
	if json.Unmarshal(ids, &photos) != nil || index >= len(photos) {
		c.Status(404)
		return
	}
	data, typ, err := fetchTelegramPhoto(c.Request.Context(), opts.Client, opts.Token, photos[index])
	if err != nil {
		c.Status(http.StatusBadGateway)
		return
	}
	c.Header("Content-Security-Policy", "default-src 'none'; sandbox")
	c.Data(http.StatusOK, typ, data)
}
