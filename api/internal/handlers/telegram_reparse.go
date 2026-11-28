package handlers

import (
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openmentor-io/openmentor/api/internal/telegramvacancy/parser"
)

func telegramReparseCandidate(raw, cityID string) gin.H {
	p := parser.Parse(parser.Message{Text: raw})
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
	if p.SalaryMin != nil || p.SalaryMax != nil {
		salary = gin.H{"min": p.SalaryMin, "max": p.SalaryMax, "currency": "RUB"}
	}
	return gin.H{"heading": p.Heading, "rawText": raw, "title": p.Title, "company": p.Company, "description": p.Introduction, "cityId": cityID, "workFormat": p.WorkFormat, "employment": p.Employment, "salary": salary, "responsibilities": lines(p.Tasks), "requirements": lines(p.Requirements), "conditions": lines(p.Benefits)}
}

func telegramReparse(c *gin.Context, pool *pgxpool.Pool) {
	var raw string
	err := pool.QueryRow(c.Request.Context(), `SELECT raw_text FROM telegram_vacancy_sources WHERE vacancy_id=$1`, c.Param("id")).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(404, gin.H{"error": "Telegram source not found"})
		return
	}
	if err != nil {
		vacancyError(c, err)
		return
	}
	city := parser.Parse(parser.Message{Text: raw}).City
	var cityID *string
	if city != "" {
		err = pool.QueryRow(c.Request.Context(), `SELECT min(id) FROM vacancy_cities WHERE active AND lower(name)=lower($1) HAVING count(*)=1`, city).Scan(&cityID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			vacancyError(c, err)
			return
		}
	}
	id := ""
	if cityID != nil {
		id = *cityID
	}
	c.JSON(200, telegramReparseCandidate(raw, id))
}
