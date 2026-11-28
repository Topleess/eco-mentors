package handlers

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type vacancyApplication struct {
	vacancyWrite
	CaptchaToken string `json:"captchaToken"`
	Contact      string `json:"contact"`
	Consent      bool   `json:"consent"`
}

func vacancyApply(c *gin.Context, pool *pgxpool.Pool, verifier vacancyCaptcha) {
	var a vacancyApplication
	if c.ShouldBindJSON(&a) != nil || !a.Consent || strings.TrimSpace(a.CaptchaToken) == "" || len(a.CaptchaToken) > 4096 || strings.TrimSpace(a.Contact) == "" || len([]rune(a.Contact)) > 500 {
		c.JSON(400, gin.H{"error": "Invalid application"})
		return
	}
	if verifier == nil || verifier.Verify(c.Request.Context(), a.CaptchaToken) != nil {
		c.JSON(400, gin.H{"error": "Captcha verification failed"})
		return
	}
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	}
	a.Slug = "application-" + hex.EncodeToString(id[:])
	a.Status = "draft"
	a.Provenance = "manual"
	body, err := json.Marshal(a.vacancyWrite)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid application"})
		return
	}
	c.Set("vacancyApplicationContact", strings.TrimSpace(a.Contact))
	c.Request.Body = io.NopCloser(bytes.NewReader(body))
	vacancySave(c, pool, false)
}
