package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openmentor-io/openmentor/api/internal/middleware"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
)

const (
	feedbackPageSize  = 25
	feedbackMaxOffset = 10000
)

type feedbackSubmission struct {
	SubmissionID string          `json:"submissionId"`
	Category     string          `json:"category"`
	Message      string          `json:"message"`
	Email        json.RawMessage `json:"email"`
	Consent      bool            `json:"consent"`
	CaptchaToken string          `json:"captchaToken"`
}

type feedbackItem struct {
	ID        string    `json:"id"`
	Category  string    `json:"category"`
	Message   string    `json:"message"`
	Email     *string   `json:"email"`
	CreatedAt time.Time `json:"createdAt"`
}

func RegisterFeedbackRoutes(r *gin.Engine, pool *pgxpool.Pool, tm *jwt.TokenManager, checker middleware.AdminSessionChecker, domain string, secure bool, verifier vacancyCaptcha) {
	limiter := middleware.NewRateLimiter(1.0/10.0, 5)
	r.POST("/api/v1/feedback", limiter.Middleware(), middleware.BodySizeLimitMiddleware(64*1024), func(c *gin.Context) { submitFeedback(c, pool, verifier) })
	r.GET("/api/v1/admin/feedback", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		if tm == nil || checker == nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "Service temporarily unavailable"})
		}
	}, middleware.AdminSessionMiddleware(tm, checker, domain, secure), func(c *gin.Context) { listFeedback(c, pool) })
}

func submitFeedback(c *gin.Context, pool *pgxpool.Pool, verifier vacancyCaptcha) {
	c.Header("Cache-Control", "no-store")
	body, err := io.ReadAll(c.Request.Body)
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Feedback is too large"})
		return
	}
	var form feedbackSubmission
	if err != nil || !utf8.Valid(body) || json.Unmarshal(body, &form) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid feedback"})
		return
	}
	form.Message = strings.TrimSpace(form.Message)
	id, validID := feedbackUUID(form.SubmissionID)
	email, validEmail := parseFeedbackEmail(form.Email)
	if !validID || !validEmail || !form.validContent() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid feedback"})
		return
	}
	ctx := c.Request.Context()
	if verifier == nil || verifier.Verify(ctx, form.CaptchaToken) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Captcha verification failed"})
		return
	}
	tag, err := pool.Exec(ctx, `INSERT INTO feedback_submissions (id,category,message,email) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`, id, form.Category, form.Message, email)
	if err != nil {
		feedbackStoreError(c)
		return
	}
	if tag.RowsAffected() == 0 {
		// A separate statement sees the committed winner even when INSERT waited on it.
		var same bool
		err = pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM feedback_submissions WHERE id=$1 AND category=$2 AND message=$3 AND email IS NOT DISTINCT FROM $4)`, id, form.Category, form.Message, email).Scan(&same)
		if err != nil {
			feedbackStoreError(c)
			return
		}
		if !same {
			c.JSON(http.StatusConflict, gin.H{"error": "Submission ID already used"})
			return
		}
	}
	c.JSON(http.StatusCreated, gin.H{"success": true})
}

func feedbackUUID(raw string) (uuid.UUID, bool) {
	id, err := uuid.Parse(raw)
	return id, err == nil && strings.EqualFold(id.String(), raw) && id.Version() == 4 && id.Variant() == uuid.RFC4122
}

func (form feedbackSubmission) validContent() bool {
	return form.Consent && validFeedbackCategory(form.Category) &&
		strings.TrimSpace(form.CaptchaToken) != "" && len(form.CaptchaToken) <= 4096 &&
		form.Message != "" && utf8.RuneCountInString(form.Message) <= 3000 && !strings.ContainsRune(form.Message, 0)
}

func validFeedbackCategory(category string) bool {
	switch category {
	case "suggestion", "problem", "question":
		return true
	default:
		return false
	}
}

func parseFeedbackEmail(raw json.RawMessage) (*string, bool) {
	if raw == nil {
		return nil, true
	}
	var email string
	if bytes.Equal(raw, []byte("null")) || json.Unmarshal(raw, &email) != nil {
		return nil, false
	}
	email = strings.TrimSpace(email)
	if email == "" {
		return nil, true
	}
	if len(email) > 254 || strings.ContainsAny(email, "\r\n\x00") {
		return nil, false
	}
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email || addr.Name != "" {
		return nil, false
	}
	return &email, true
}

func listFeedback(c *gin.Context, pool *pgxpool.Pool) {
	session, err := middleware.GetAdminSession(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	if string(session.Role) != staffAdminRole {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	offset := 0
	if raw, present := c.GetQueryArray("offset"); present {
		if len(raw) != 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid offset"})
			return
		}
		offset, err = strconv.Atoi(raw[0])
		if err != nil || offset < 0 || offset > feedbackMaxOffset {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid offset"})
			return
		}
	}
	rows, err := pool.Query(c.Request.Context(), `SELECT id,category,message,email,created_at FROM feedback_submissions ORDER BY created_at DESC,id DESC LIMIT $1 OFFSET $2`, feedbackPageSize+1, offset)
	if err != nil {
		feedbackStoreError(c)
		return
	}
	defer rows.Close()
	items := make([]feedbackItem, 0, feedbackPageSize+1)
	for rows.Next() {
		var item feedbackItem
		if err := rows.Scan(&item.ID, &item.Category, &item.Message, &item.Email, &item.CreatedAt); err != nil {
			feedbackStoreError(c)
			return
		}
		item.CreatedAt = item.CreatedAt.UTC()
		items = append(items, item)
	}
	if rows.Err() != nil {
		feedbackStoreError(c)
		return
	}
	hasMore := len(items) > feedbackPageSize
	if hasMore {
		items = items[:feedbackPageSize]
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "hasMore": hasMore})
}

func feedbackStoreError(c *gin.Context) {
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
}
