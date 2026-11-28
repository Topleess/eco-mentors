package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openmentor-io/openmentor/api/internal/telegramvacancy/parser"
)

// telegramVacancyImport accepts a Telegram message with chat.id and message_id.
type telegramImportMessage struct {
	parser.Message
	MessageID int64 `json:"message_id"`
	Chat      struct {
		ID int64 `json:"id"`
	} `json:"chat"`
	SourceURL string `json:"source_url"`
}

func telegramVacancyImport(c *gin.Context, pool *pgxpool.Pool) {
	var m telegramImportMessage
	if c.ShouldBindJSON(&m) != nil || m.Chat.ID == 0 || m.MessageID <= 0 || (strings.TrimSpace(m.Text) == "" && strings.TrimSpace(m.Caption) == "") {
		c.JSON(400, gin.H{"error": "Invalid Telegram message"})
		return
	}
	id, created, err := importTelegramMessage(c.Request.Context(), pool, m)
	if err != nil {
		if errors.Is(err, errInvalidTelegramSource) {
			c.JSON(400, gin.H{"error": "Invalid source URL"})
		} else {
			vacancyError(c, err)
		}
		return
	}
	var result json.RawMessage
	if err = pool.QueryRow(c.Request.Context(), vacancyAdminSelect+" WHERE v.id=$1", id).Scan(&result); err != nil {
		vacancyError(c, err)
		return
	}
	code := 200
	if created {
		code = 201
	}
	c.JSON(code, gin.H{"vacancy": result, "created": created})
}

var errInvalidTelegramSource = errors.New("invalid source URL")

func importTelegramMessage(ctx context.Context, pool *pgxpool.Pool, m telegramImportMessage) (string, bool, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return "", false, err
	}
	defer tx.Rollback(context.Background()) //nolint:errcheck // Best-effort rollback after commit or failure.
	id, created, err := importTelegramMessageTx(ctx, tx, m)
	if err != nil {
		return "", false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", false, err
	}
	return id, created, nil
}

//nolint:gocyclo // Import validation and transactional flow are deliberately kept together.
func importTelegramMessageTx(ctx context.Context, tx pgx.Tx, m telegramImportMessage) (string, bool, error) {
	parsed := parser.Parse(m.Message)
	source := m.SourceURL
	if source == "" {
		source = parsed.SourceURL
	}
	if source != "" {
		u, err := url.Parse(source)
		if err != nil || (u.Scheme != telegramHTTPSScheme && u.Scheme != "http") || u.Host == "" {
			return "", false, errInvalidTelegramSource
		}
	}
	var err error
	// Serialize per source key before checking: avoids duplicate vacancies under concurrent imports.
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", fmt.Sprintf("telegram:%d:%d", m.Chat.ID, m.MessageID)); err != nil {
		return "", false, err
	}
	var id string
	err = tx.QueryRow(ctx, "SELECT vacancy_id FROM telegram_vacancy_sources WHERE channel_id=$1 AND message_id=$2", m.Chat.ID, m.MessageID).Scan(&id)
	created := false
	if errors.Is(err, pgx.ErrNoRows) {
		lines := func(s string) []string {
			out := []string{}
			for _, line := range strings.Split(s, "\n") {
				if strings.TrimSpace(line) != "" {
					out = append(out, line)
				}
			}
			return out
		}
		var salary any
		if parsed.SalaryMin != nil || parsed.SalaryMax != nil {
			salary = gin.H{"min": parsed.SalaryMin, "max": parsed.SalaryMax, "currency": "RUB"}
		}
		var cityID *string
		if parsed.City != "" {
			err = tx.QueryRow(ctx, "SELECT min(id) FROM vacancy_cities WHERE active AND lower(name)=lower($1) HAVING count(*)=1", parsed.City).Scan(&cityID)
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				return "", false, err
			}
		}
		payload, _ := json.Marshal(gin.H{"title": parsed.Title, "company": parsed.Company, "workFormat": parsed.WorkFormat, "experience": "", "employment": parsed.Employment, "salary": salary, "description": parsed.Introduction, "responsibilities": lines(parsed.Tasks), "requirements": lines(parsed.Requirements), "conditions": lines(parsed.Benefits), "provenance": "manual", "reviewRequired": true}) //nolint:errcheck // Payload contains only JSON-compatible values.
		err = tx.QueryRow(ctx, "INSERT INTO vacancies (slug, industry_id, city_id, status, payload) VALUES ('telegram-' || gen_random_uuid()::text,NULL,$2,'draft',$1) RETURNING id", payload, cityID).Scan(&id)
		if err == nil {
			photos := parsed.PhotoFileIDs
			if photos == nil {
				photos = []string{}
			}
			var b []byte
			b, err = json.Marshal(photos)
			if err == nil {
				_, err = tx.Exec(ctx, "INSERT INTO telegram_vacancy_sources(channel_id,message_id,vacancy_id,raw_text,photo_ids,source_url) VALUES ($1,$2,$3,$4,$5,$6)", m.Chat.ID, m.MessageID, id, parsed.OriginalText, b, source)
			}
		}
		created = true
	}
	if err != nil {
		return "", false, err
	}
	return id, created, nil
}
