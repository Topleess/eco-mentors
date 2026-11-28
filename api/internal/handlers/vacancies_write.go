package handlers

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type vacancyWrite struct {
	Slug       string `json:"slug"`
	Title      string `json:"title"`
	Company    string `json:"company"`
	IndustryID string `json:"industryId"`
	CityID     string `json:"cityId"`
	WorkFormat string `json:"workFormat"`
	Status     string `json:"status"`
	Salary     *struct {
		Min      *int64 `json:"min"`
		Max      *int64 `json:"max"`
		Currency string `json:"currency"`
	} `json:"salary"`
	Experience       string   `json:"experience"`
	Employment       string   `json:"employment"`
	Description      string   `json:"description"`
	Responsibilities []string `json:"responsibilities"`
	Requirements     []string `json:"requirements"`
	Conditions       []string `json:"conditions"`
	Provenance       string   `json:"provenance"`
	Version          int      `json:"version"`
}

func vacancySave(c *gin.Context, pool *pgxpool.Pool, update bool) { //nolint:gocyclo // Validates the bounded full-replacement payload and commits its references atomically.
	var v vacancyWrite
	if c.ShouldBindJSON(&v) != nil {
		c.JSON(400, gin.H{"error": "Invalid vacancy payload"})
		return
	}
	if v.Provenance == "" {
		v.Provenance = "manual"
	}
	valid := vacancySlug.MatchString(v.Slug) && len(v.Slug) <= 100 && len([]rune(v.Title)) <= 200 && len([]rune(v.Company)) <= 200 && oneOf(v.Status, "draft", vacancyPublishedStatus, "archived") && (v.Status == "draft" && v.WorkFormat == "" || oneOf(v.WorkFormat, "remote", "hybrid", "office")) && (v.Status == "draft" && v.Experience == "" || oneOf(v.Experience, "junior", "middle", "senior")) && (v.Status == "draft" && v.Employment == "" || oneOf(v.Employment, "fullTime", "partTime", "internship")) && oneOf(v.Provenance, "synthetic", "manual") && len([]rune(v.Description)) <= 30000 && (!update || v.Version > 0)
	if v.Status != "draft" {
		valid = valid && strings.TrimSpace(v.Title) != "" && strings.TrimSpace(v.Company) != "" && v.IndustryID != "" && v.CityID != ""
	}
	if v.Status == vacancyPublishedStatus {
		valid = valid && strings.TrimSpace(v.Description) != ""
	}
	if v.Salary != nil {
		s := v.Salary
		valid = valid && s.Currency == "RUB" && (s.Min != nil || s.Max != nil) && (s.Min == nil || *s.Min >= 0) && (s.Max == nil || *s.Max >= 0) && (s.Min == nil || s.Max == nil || *s.Min <= *s.Max)
	}
	for _, list := range [][]string{v.Responsibilities, v.Requirements, v.Conditions} {
		if len(list) > 100 {
			valid = false
		}
		for _, line := range list {
			if strings.TrimSpace(line) == "" || len([]rune(line)) > 2000 {
				valid = false
			}
		}
	}
	if !valid {
		c.JSON(400, gin.H{"error": "Invalid vacancy fields"})
		return
	}
	if v.Responsibilities == nil {
		v.Responsibilities = []string{}
	}
	if v.Requirements == nil {
		v.Requirements = []string{}
	}
	if v.Conditions == nil {
		v.Conditions = []string{}
	}
	ctx := c.Request.Context()
	tx, err := pool.Begin(ctx)
	if err != nil {
		vacancyError(c, err)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }() //nolint:errcheck // No-op after commit; closing releases a failed transaction.
	var oldIndustry, oldCity, oldSlug string
	if update {
		var version int
		err = tx.QueryRow(ctx, "SELECT COALESCE(industry_id,''),COALESCE(city_id,''),slug,version FROM vacancies WHERE id=$1 FOR UPDATE", c.Param("id")).Scan(&oldIndustry, &oldCity, &oldSlug, &version)
		if err != nil {
			vacancyError(c, err)
			return
		}
		if version != v.Version {
			c.JSON(409, gin.H{"error": "Vacancy changed; reload before saving"})
			return
		}
		if oldSlug != v.Slug {
			c.JSON(400, gin.H{"error": "Slug is immutable"})
			return
		}
	}
	for _, ref := range []struct{ table, id, old string }{{"vacancy_industries", v.IndustryID, oldIndustry}, {"vacancy_cities", v.CityID, oldCity}} {
		if ref.id == "" {
			continue
		}
		var active bool
		err = tx.QueryRow(ctx, "SELECT active FROM "+ref.table+" WHERE id=$1 FOR SHARE", ref.id).Scan(&active)
		if errors.Is(err, pgx.ErrNoRows) || err == nil && !active && ref.id != ref.old {
			c.JSON(400, gin.H{"error": "Dictionary reference missing or inactive"})
			return
		}
		if err != nil {
			vacancyError(c, err)
			return
		}
	}
	payload, err := json.Marshal(v)
	if err != nil {
		vacancyError(c, err)
		return
	}
	var id string
	if update {
		err = tx.QueryRow(ctx, "UPDATE vacancies SET industry_id=NULLIF($1,''),city_id=NULLIF($2,''),status=$3,payload=$4,version=version+1,updated_at=clock_timestamp() WHERE id=$5 AND version=$6 RETURNING id", v.IndustryID, v.CityID, v.Status, payload, c.Param("id"), v.Version).Scan(&id)
	} else {
		err = tx.QueryRow(ctx, "INSERT INTO vacancies (slug,industry_id,city_id,status,payload) VALUES($1,NULLIF($2,''),NULLIF($3,''),$4,$5) RETURNING id", v.Slug, v.IndustryID, v.CityID, v.Status, payload).Scan(&id)
	}
	if err != nil {
		vacancyError(c, err)
		return
	}
	if contact, ok := c.Get("vacancyApplicationContact"); ok {
		if _, err = tx.Exec(ctx, "INSERT INTO vacancy_applications (vacancy_id,contact) VALUES ($1,$2)", id, contact); err != nil {
			vacancyError(c, err)
			return
		}
	}
	if err = tx.Commit(ctx); err != nil {
		vacancyError(c, err)
		return
	}
	if _, ok := c.Get("vacancyApplicationContact"); ok {
		c.JSON(201, gin.H{"success": true})
		return
	}
	var b json.RawMessage
	if err = pool.QueryRow(ctx, vacancyAdminSelect+" WHERE v.id=$1", id).Scan(&b); err != nil {
		vacancyError(c, err)
		return
	}
	code := 201
	if update {
		code = 200
	}
	c.JSON(code, gin.H{"vacancy": b})
}
func oneOf(value string, choices ...string) bool {
	for _, v := range choices {
		if value == v {
			return true
		}
	}
	return false
}
