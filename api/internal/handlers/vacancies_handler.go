package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openmentor-io/openmentor/api/internal/middleware"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
	"github.com/openmentor-io/openmentor/api/pkg/logger"
)

const vacancySelect = `SELECT v.payload || jsonb_build_object('id',v.id,'slug',v.slug,'industryId',v.industry_id,'cityId',v.city_id,'industry',i.name,'location',c.name,'status',v.status,'version',v.version,'createdAt',v.created_at,'updatedAt',v.updated_at) FROM vacancies v JOIN vacancy_industries i ON i.id=v.industry_id JOIN vacancy_cities c ON c.id=v.city_id `

func RegisterVacancyRoutes(r *gin.Engine, pool *pgxpool.Pool, tm *jwt.TokenManager, checker middleware.AdminSessionChecker, domain string, secure bool) {
	public := r.Group("/api/v1/vacancies")
	public.GET("", func(c *gin.Context) { vacancyList(c, pool, true) })
	public.GET("/dictionaries", func(c *gin.Context) {
		industries, err := dictionaryList(c.Request.Context(), pool, "vacancy_industries", true)
		if err != nil {
			vacancyError(c, err)
			return
		}
		cities, err := dictionaryList(c.Request.Context(), pool, "vacancy_cities", true)
		if err != nil {
			vacancyError(c, err)
			return
		}
		c.JSON(200, gin.H{"industries": industries, "cities": cities})
	})
	public.GET("/:slug", func(c *gin.Context) { vacancyGet(c, pool, true) })
	if tm == nil {
		return
	}
	admin := r.Group("/api/v1/admin")
	admin.Use(middleware.AdminSessionMiddleware(tm, checker, domain, secure), func(c *gin.Context) {
		s, err := middleware.GetAdminSession(c)
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized"})
			return
		}
		if string(s.Role) != "admin" {
			c.AbortWithStatusJSON(403, gin.H{"error": "Access denied"})
			return
		}
		c.Next()
	})
	admin.GET("/vacancies", func(c *gin.Context) { vacancyList(c, pool, false) })
	admin.GET("/vacancies/:id", func(c *gin.Context) { vacancyGet(c, pool, false) })
	admin.POST("/vacancies", func(c *gin.Context) { vacancySave(c, pool, false) })
	admin.PUT("/vacancies/:id", func(c *gin.Context) { vacancySave(c, pool, true) })
	for _, kind := range []string{"industries", "cities"} {
		table := "vacancy_" + kind
		path := "/vacancy-" + kind
		admin.GET(path, func(c *gin.Context) {
			items, err := dictionaryList(c.Request.Context(), pool, table, false)
			if err != nil {
				vacancyError(c, err)
				return
			}
			c.JSON(200, gin.H{"items": items})
		})
		admin.POST(path, func(c *gin.Context) { dictionarySave(c, pool, table, false) })
		admin.PUT(path+"/:id", func(c *gin.Context) { dictionarySave(c, pool, table, true) })
		admin.DELETE(path+"/:id", func(c *gin.Context) {
			tag, err := pool.Exec(c.Request.Context(), "DELETE FROM "+table+" WHERE id=$1", c.Param("id"))
			if err != nil {
				vacancyError(c, err)
				return
			}
			if tag.RowsAffected() != 1 {
				c.JSON(404, gin.H{"error": "Not found"})
				return
			}
			c.JSON(200, gin.H{"deleted": true})
		})
	}
}

func vacancyList(c *gin.Context, pool *pgxpool.Pool, public bool) {
	query := vacancySelect
	if public {
		query += " WHERE v.status='published'"
	}
	query += " ORDER BY v.created_at,v.id"
	rows, err := pool.Query(c.Request.Context(), query)
	if err != nil {
		vacancyError(c, err)
		return
	}
	defer rows.Close()
	items := []json.RawMessage{}
	for rows.Next() {
		var b json.RawMessage
		if err := rows.Scan(&b); err != nil {
			vacancyError(c, err)
			return
		}
		items = append(items, b)
	}
	if err = rows.Err(); err != nil {
		vacancyError(c, err)
		return
	}
	c.JSON(200, gin.H{"vacancies": items})
}
func vacancyGet(c *gin.Context, pool *pgxpool.Pool, public bool) {
	query := vacancySelect + " WHERE v.id=$1"
	id := c.Param("id")
	if public {
		query = vacancySelect + " WHERE v.slug=$1 AND v.status='published'"
		id = c.Param("slug")
	}
	var b json.RawMessage
	if err := pool.QueryRow(c.Request.Context(), query, id).Scan(&b); err != nil {
		vacancyError(c, err)
		return
	}
	c.JSON(200, gin.H{"vacancy": b})
}
func dictionaryList(ctx context.Context, pool *pgxpool.Pool, table string, active bool) ([]json.RawMessage, error) {
	query := "SELECT jsonb_build_object('id',id,'slug',slug,'name',name,'active',active,'version',version,'updatedAt',updated_at) FROM " + table
	if active {
		query += " WHERE active"
	}
	query += " ORDER BY name,id"
	rows, err := pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []json.RawMessage{}
	for rows.Next() {
		var b json.RawMessage
		if err := rows.Scan(&b); err != nil {
			return nil, err
		}
		items = append(items, b)
	}
	return items, rows.Err()
}

var vacancySlug = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

func dictionarySave(c *gin.Context, pool *pgxpool.Pool, table string, update bool) {
	var v struct {
		Slug    string `json:"slug"`
		Name    string `json:"name"`
		Active  *bool  `json:"active"`
		Version int    `json:"version"`
	}
	if c.ShouldBindJSON(&v) != nil || !vacancySlug.MatchString(v.Slug) || len(v.Slug) > 100 || strings.TrimSpace(v.Name) == "" || len([]rune(v.Name)) > 150 || v.Active == nil || (update && v.Version < 1) {
		c.JSON(400, gin.H{"error": "Invalid dictionary entry"})
		return
	}
	var id string
	var err error
	if update {
		err = pool.QueryRow(c.Request.Context(), "UPDATE "+table+" SET name=$1,active=$2,version=version+1,updated_at=clock_timestamp() WHERE id=$3 AND version=$4 AND slug=$5 RETURNING id", strings.TrimSpace(v.Name), *v.Active, c.Param("id"), v.Version, v.Slug).Scan(&id)
	} else {
		err = pool.QueryRow(c.Request.Context(), "INSERT INTO "+table+" (slug,name,active) VALUES ($1,$2,$3) RETURNING id", v.Slug, strings.TrimSpace(v.Name), *v.Active).Scan(&id)
	}
	if errors.Is(err, pgx.ErrNoRows) && update {
		dictionaryUpdateMiss(c, pool, table)
		return
	}
	if err != nil {
		vacancyError(c, err)
		return
	}
	var b json.RawMessage
	err = pool.QueryRow(c.Request.Context(), "SELECT jsonb_build_object('id',id,'slug',slug,'name',name,'active',active,'version',version,'updatedAt',updated_at) FROM "+table+" WHERE id=$1", id).Scan(&b)
	if err != nil {
		vacancyError(c, err)
		return
	}
	code := 201
	if update {
		code = 200
	}
	c.JSON(code, gin.H{"item": b})
}
func dictionaryUpdateMiss(c *gin.Context, pool *pgxpool.Pool, table string) {
	var exists bool
	if err := pool.QueryRow(c.Request.Context(), "SELECT EXISTS(SELECT 1 FROM "+table+" WHERE id=$1)", c.Param("id")).Scan(&exists); err != nil {
		vacancyError(c, err)
		return
	}
	if !exists {
		c.JSON(404, gin.H{"error": "Not found"})
		return
	}
	c.JSON(409, gin.H{"error": "Entry changed or slug is immutable"})
}

func vacancyError(c *gin.Context, err error) {
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(404, gin.H{"error": "Not found"})
		return
	}
	var pe *pgconn.PgError
	if errors.As(err, &pe) {
		switch pe.Code {
		case "23505", "23503":
			c.JSON(409, gin.H{"error": "Duplicate slug or dictionary entry is in use"})
			return
		case "23514", "23502":
			c.JSON(400, gin.H{"error": "Invalid vacancy data"})
			return
		}
	}
	logger.Error("Vacancy database operation failed", logger.RedactedError(err))
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
}
