package handlers

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/url"
	"time"

	"encoding/json"
	"errors"
	"strings"
	"unicode/utf16"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openmentor-io/openmentor/api/internal/middleware"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
)

type telegramVacancyLinks struct{ SourceURL, PublicBaseURL, Slug string }

//nolint:gocyclo // Formatting and URL validation are kept together.
func telegramVacancyText(payload []byte, links ...telegramVacancyLinks) (string, error) {
	var v struct {
		Title            string   `json:"title"`
		Company          string   `json:"company"`
		Description      string   `json:"description"`
		Responsibilities []string `json:"responsibilities"`
		Requirements     []string `json:"requirements"`
		Conditions       []string `json:"conditions"`
	}
	if err := json.Unmarshal(payload, &v); err != nil {
		return "", err
	}
	if strings.TrimSpace(v.Title) == "" || strings.TrimSpace(v.Company) == "" {
		return "", errors.New("missing vacancy fields")
	}
	text := strings.TrimSpace(v.Title) + "\n" + strings.TrimSpace(v.Company)
	if strings.TrimSpace(v.Description) != "" {
		text += "\n\n" + strings.TrimSpace(v.Description)
	}

	for _, section := range []struct {
		title string
		items []string
	}{{"Обязанности", v.Responsibilities}, {"Требования", v.Requirements}, {"Условия", v.Conditions}} {
		var items []string
		for _, item := range section.items {
			if trimmed := strings.TrimSpace(item); trimmed != "" {
				items = append(items, "• "+trimmed)
			}
		}
		if len(items) > 0 {
			text += "\n\n" + section.title + ":\n" + strings.Join(items, "\n")
		}
	}
	if len(links) > 0 {
		link := links[0]
		if link.SourceURL != "" {
			if !validTelegramVacancyURL(link.SourceURL) {
				return "", errors.New("invalid source URL")
			}
			text += "\n\nИсточник: " + link.SourceURL
		}
		if link.PublicBaseURL != "" {
			if !validTelegramVacancyURL(link.PublicBaseURL) || strings.TrimSpace(link.Slug) == "" {
				return "", errors.New("invalid public vacancy URL")
			}
			base, _ := url.Parse(link.PublicBaseURL) //nolint:errcheck // URL was validated immediately above.
			if base.RawQuery != "" || base.Fragment != "" {
				return "", errors.New("invalid public base URL")
			}
			text += "\n\nВакансия: " + strings.TrimRight(link.PublicBaseURL, "/") + "/vacancies/" + url.PathEscape(link.Slug)
		}
	}
	if len(utf16.Encode([]rune(text))) > 4096 {
		return "", errors.New("telegram text too long")
	}
	return text, nil
}

func validTelegramVacancyURL(raw string) bool {
	u, err := url.Parse(raw)
	return err == nil && (u.Scheme == "http" || u.Scheme == telegramHTTPSScheme) && u.Hostname() != "" && u.User == nil && !strings.ContainsAny(raw, "\r\n\t ")
}

// TelegramVacancyOptions contains server-side credentials; never return them to clients.
type TelegramVacancyOptions struct {
	Token         string
	ChatID        string
	Client        *http.Client
	PublicBaseURL string
}

func RegisterTelegramVacancyRoutes(r *gin.Engine, pool *pgxpool.Pool, tm *jwt.TokenManager, checker middleware.AdminSessionChecker, domain string, secure bool, opts TelegramVacancyOptions) {
	if tm == nil {
		return
	}
	if opts.Client == nil {
		opts.Client = &http.Client{Timeout: 15 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	}
	g := r.Group("/api/v1/admin/vacancies/:id/telegram")
	g.Use(middleware.AdminSessionMiddleware(tm, checker, domain, secure), researchAdminOnly)
	g.GET("/photos/:index", func(c *gin.Context) { telegramPhoto(c, pool, opts) })
	g.POST("/preview", func(c *gin.Context) { telegramPreview(c, pool, opts) })
	g.POST("/publish", middleware.BodySizeLimitMiddleware(1024), func(c *gin.Context) { telegramPublish(c, pool, opts) })
}

func telegramPreview(c *gin.Context, pool *pgxpool.Pool, opts TelegramVacancyOptions) {
	var payload []byte
	var version int
	var slug, source string
	err := pool.QueryRow(c.Request.Context(), `SELECT v.payload, v.version, v.slug, COALESCE((SELECT s.source_url FROM telegram_vacancy_sources s WHERE s.vacancy_id=v.id), '') FROM vacancies v WHERE v.id=$1`, c.Param("id")).Scan(&payload, &version, &slug, &source)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(404, gin.H{"error": "Not found"})
		return
	}
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	text, err := telegramVacancyText(payload, telegramVacancyLinks{SourceURL: source, PublicBaseURL: opts.PublicBaseURL, Slug: slug})
	if err != nil {
		c.JSON(422, gin.H{"error": "Cannot create Telegram preview"})
		return
	}
	c.JSON(200, gin.H{"text": text, "version": version})
}

//nolint:gocyclo // Publication checks and transaction steps are kept together.
func telegramPublish(c *gin.Context, pool *pgxpool.Pool, opts TelegramVacancyOptions) {
	var req struct {
		Version int `json:"version"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Version < 1 {
		c.JSON(400, gin.H{"error": "Invalid version"})
		return
	}
	if strings.TrimSpace(opts.Token) == "" || strings.TrimSpace(opts.ChatID) == "" {
		c.JSON(503, gin.H{"error": "Telegram not configured"})
		return
	}
	ctx := c.Request.Context()
	// A session lock spans the committed reservation and the external request.
	// The poller takes the same lock transactionally before recognizing a post.
	conn, err := pool.Acquire(ctx)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	defer conn.Release()
	if _, err = conn.Exec(ctx, `SELECT pg_advisory_lock(hashtextextended('telegram-vacancy-publication',0))`); err != nil {
		// A canceled query can leave acquisition ambiguous; never return a
		// potentially locked session to the pool.
		_ = conn.Conn().Close(context.Background())
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	defer func() {
		unlockCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := conn.Exec(unlockCtx, `SELECT pg_advisory_unlock(hashtextextended('telegram-vacancy-publication',0))`); err != nil {
			_ = conn.Conn().Close(context.Background())
		}
	}()
	tx, err := conn.Begin(ctx)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	defer tx.Rollback(context.Background()) //nolint:errcheck // Best-effort rollback after commit or failure.
	var payload []byte
	var version int
	var slug, source, status string
	err = tx.QueryRow(ctx, `SELECT v.payload,v.version,v.slug,COALESCE((SELECT s.source_url FROM telegram_vacancy_sources s WHERE s.vacancy_id=v.id), ''),v.status FROM vacancies v WHERE v.id=$1 FOR UPDATE`, c.Param("id")).Scan(&payload, &version, &slug, &source, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(404, gin.H{"error": "Not found"})
		return
	}
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	if status != vacancyPublishedStatus {
		c.JSON(409, gin.H{"error": "Vacancy is not published"})
		return
	}
	if version != req.Version {
		c.JSON(409, gin.H{"error": "Vacancy changed; preview again"})
		return
	}
	text, err := telegramVacancyText(payload, telegramVacancyLinks{SourceURL: source, PublicBaseURL: opts.PublicBaseURL, Slug: slug})
	if err != nil {
		c.JSON(422, gin.H{"error": "Cannot create Telegram preview"})
		return
	}
	var existingVersion int
	var messageID *int64
	err = tx.QueryRow(ctx, `SELECT version,message_id FROM vacancy_telegram_publications WHERE vacancy_id=$1`, c.Param("id")).Scan(&existingVersion, &messageID)
	if err == nil {
		if existingVersion == version && messageID != nil {
			c.JSON(200, gin.H{"messageId": *messageID})
			return
		}
		c.JSON(409, gin.H{"error": "Telegram publication already attempted"})
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	_, err = tx.Exec(ctx, `INSERT INTO vacancy_telegram_publications(vacancy_id,version) VALUES($1,$2)`, c.Param("id"), version)
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	// Commit the reservation before making an irreversible external call. An
	// interrupted or ambiguous attempt remains reserved and cannot be retried.
	if err = tx.Commit(ctx); err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}
	id, err := sendTelegramVacancy(ctx, opts.Client, opts.Token, opts.ChatID, text)
	if err != nil {
		c.JSON(502, gin.H{"error": "Telegram publication could not be confirmed"})
		return
	}
	// A failed readback/update is ambiguous, so keep the reservation indefinitely.
	resultCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	tag, err := conn.Exec(resultCtx, `UPDATE vacancy_telegram_publications SET message_id=$1 WHERE vacancy_id=$2 AND version=$3 AND message_id IS NULL`, id, c.Param("id"), version)
	if err != nil || tag.RowsAffected() != 1 {
		c.JSON(500, gin.H{"error": "Telegram publication could not be confirmed"})
		return
	}
	c.JSON(200, gin.H{"messageId": id})
}

func sendTelegramVacancy(ctx context.Context, client *http.Client, token, chatID, text string) (int64, error) {
	data, err := json.Marshal(map[string]string{"chat_id": chatID, "text": text})
	if err != nil {
		return 0, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.telegram.org/bot"+token+"/sendMessage", bytes.NewReader(data))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	var body struct {
		OK     bool `json:"ok"`
		Result struct {
			MessageID int64 `json:"message_id"`
		} `json:"result"`
	}
	if resp.StatusCode != http.StatusOK {
		return 0, errors.New("Telegram request failed") //nolint:staticcheck // Preserve existing error text.
	}
	if err = json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&body); err != nil || !body.OK || body.Result.MessageID <= 0 {
		return 0, errors.New("invalid Telegram response")
	}
	return body.Result.MessageID, nil
}
