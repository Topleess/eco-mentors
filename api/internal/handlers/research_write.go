package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openmentor-io/openmentor/api/pkg/logger"
	"github.com/openmentor-io/openmentor/api/pkg/s3storage"
)

type researchSection struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Body  string `json:"body"`
}
type researchInput struct {
	Slug           string            `json:"slug"`
	Title          string            `json:"title"`
	Summary        string            `json:"summary"`
	Category       string            `json:"category"`
	Author         string            `json:"author"`
	PublishedOn    string            `json:"publishedOn"`
	ReadingMinutes int               `json:"readingMinutes"`
	CoverURL       string            `json:"coverUrl"`
	CoverAlt       string            `json:"coverAlt"`
	PDFURL         string            `json:"pdfUrl"`
	Sections       []researchSection `json:"sections"`
	KeyFindings    []string          `json:"keyFindings"`
	Citation       string            `json:"citation"`
	Status         string            `json:"status"`
	Version        int               `json:"version"`
}

const researchPublished = "published"

var researchAnchor = regexp.MustCompile(`^[a-z0-9-]{1,80}$`)

func researchText(s string, limit int, required bool) bool {
	return utf8.ValidString(s) && utf8.RuneCountInString(s) <= limit && (!required || strings.TrimSpace(s) != "") && !strings.ContainsRune(s, 0)
}

//nolint:gocyclo // Explicit URL allowlist checks fail closed independently.
func researchAsset(s string) bool {
	if s == "" {
		return true
	}
	if strings.HasPrefix(s, "/api/") {
		return strings.HasPrefix(s, "/api/research/covers/") && s3storage.ValidResearchCoverID(strings.TrimPrefix(s, "/api/research/covers/"))
	}
	if len(s) > 2048 {
		return false
	}
	decoded := s
	for range 8 {
		next, err := url.PathUnescape(decoded)
		if err != nil {
			return false
		}
		if next == decoded {
			break
		}
		decoded = next
	}
	if strings.ContainsAny(decoded, "\\%") || strings.IndexFunc(decoded, unicode.IsControl) >= 0 {
		return false
	}
	u, err := url.Parse(decoded)
	if err != nil || u.User != nil {
		return false
	}
	if u.Scheme == "" {
		if u.Host != "" || !strings.HasPrefix(decoded, "/research-assets/") {
			return false
		}
	} else if u.Scheme != "https" || u.Hostname() == "" || u.Opaque != "" {
		return false
	}
	for _, part := range strings.Split(u.Path, "/") {
		if part == "." || part == ".." {
			return false
		}
	}
	return true
}

//nolint:gocyclo // Keep the bounded article contract in one validation boundary.
func (v researchInput) valid(update bool) bool {
	if !strings.HasPrefix(v.Slug, "research-") {
		return false
	}
	id := strings.TrimPrefix(v.Slug, "research-")
	if _, err := uuid.Parse(id); err != nil || len(id) != 36 {
		return false
	}
	if !researchText(v.Title, 240, true) || !researchText(v.Summary, 2000, true) || !researchText(v.Category, 120, true) || !researchText(v.Author, 240, true) || !researchText(v.CoverAlt, 300, false) || !researchText(v.Citation, 2000, false) {
		return false
	}
	d, err := time.Parse("2006-01-02", v.PublishedOn)
	if err != nil || d.Format("2006-01-02") != v.PublishedOn {
		return false
	}
	if v.ReadingMinutes < 1 || v.ReadingMinutes > 240 || (update && v.Version < 1) || !researchAsset(v.CoverURL) || !researchAsset(v.PDFURL) {
		return false
	}
	if v.Status != "draft" && v.Status != researchPublished && v.Status != "archived" {
		return false
	}
	if len(v.Sections) < 1 || len(v.Sections) > 30 || len(v.KeyFindings) > 20 {
		return false
	}
	seen := map[string]bool{}
	for _, s := range v.Sections {
		if !researchAnchor.MatchString(s.ID) || seen[s.ID] || !researchText(s.Title, 240, true) || !researchText(s.Body, 20000, true) {
			return false
		}
		seen[s.ID] = true
	}
	for _, s := range v.KeyFindings {
		if !researchText(s, 2000, false) {
			return false
		}
	}
	return true
}
func researchID(c *gin.Context) bool {
	if _, err := uuid.Parse(c.Param("id")); err != nil {
		c.JSON(400, gin.H{"error": "Invalid research ID"})
		return false
	}
	return true
}
func researchGet(c *gin.Context, pool *pgxpool.Pool, public bool) {
	q := researchSelect + " WHERE id=$1"
	id := c.Param("id")
	if public {
		q = researchSelect + " WHERE slug=$1 AND status='published'"
		id = c.Param("slug")
	} else if !researchID(c) {
		return
	}
	var b json.RawMessage
	if err := pool.QueryRow(c.Request.Context(), q, id).Scan(&b); err != nil {
		researchError(c, err)
		return
	}
	c.JSON(200, gin.H{"research": b})
}
func researchSave(c *gin.Context, pool *pgxpool.Pool, update bool) {
	if update && !researchID(c) {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1048576)
	var v researchInput
	dec := json.NewDecoder(c.Request.Body)
	if dec.Decode(&v) != nil || dec.Decode(new(interface{})) != io.EOF || !v.valid(update) {
		c.JSON(400, gin.H{"error": "Invalid research data"})
		return
	}
	if v.KeyFindings == nil {
		v.KeyFindings = []string{}
	}
	payload, err := json.Marshal(v)
	if err != nil {
		researchError(c, err)
		return
	}
	// Identity, lifecycle, provenance and concurrency metadata are never read from payload.
	var b json.RawMessage
	fields := `payload || jsonb_build_object('id',id,'slug',slug,'status',status,'provenance',provenance,'version',version,'createdAt',created_at,'updatedAt',updated_at)`
	if update {
		err = pool.QueryRow(c.Request.Context(), `UPDATE research SET payload=$1,status=$2,version=version+1,updated_at=clock_timestamp() WHERE id=$3 AND version=$4 AND slug=$5 RETURNING `+fields, payload, v.Status, c.Param("id"), v.Version, v.Slug).Scan(&b)
		if errors.Is(err, pgx.ErrNoRows) {
			var exists bool
			if e := pool.QueryRow(c.Request.Context(), "SELECT EXISTS(SELECT 1 FROM research WHERE id=$1)", c.Param("id")).Scan(&exists); e != nil {
				researchError(c, e)
				return
			}
			if exists {
				c.JSON(409, gin.H{"error": "Research changed or slug is immutable"})
			} else {
				c.JSON(404, gin.H{"error": "Not found"})
			}
			return
		}
	} else {
		err = pool.QueryRow(c.Request.Context(), `INSERT INTO research(slug,status,payload) VALUES($1,$2,$3) RETURNING `+fields, v.Slug, v.Status, payload).Scan(&b)
	}
	if err != nil {
		researchError(c, err)
		return
	}
	code := 201
	if update {
		code = 200
	}
	c.JSON(code, gin.H{"research": b})
}
func researchError(c *gin.Context, err error) {
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(404, gin.H{"error": "Not found"})
		return
	}
	var pe *pgconn.PgError
	if errors.As(err, &pe) {
		if pe.Code == "23505" {
			c.JSON(409, gin.H{"error": "Duplicate research slug"})
			return
		}
		if pe.Code == "23514" || pe.Code == "23502" {
			c.JSON(400, gin.H{"error": "Invalid research data"})
			return
		}
	}
	logger.Error("Research database operation failed", logger.RedactedError(err))
	c.JSON(500, gin.H{"error": "Internal server error"})
}
