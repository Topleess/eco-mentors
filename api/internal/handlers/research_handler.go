package handlers

import (
	"encoding/json"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openmentor-io/openmentor/api/internal/middleware"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
)

const researchSelect = `SELECT payload || jsonb_build_object('id',id,'slug',slug,'status',status,'provenance',provenance,'version',version,'createdAt',created_at,'updatedAt',updated_at) FROM research `

func RegisterResearchRoutes(r *gin.Engine, pool *pgxpool.Pool, tm *jwt.TokenManager, checker middleware.AdminSessionChecker, domain string, secure bool) {
	r.GET("/api/v1/research", func(c *gin.Context) { researchList(c, pool, true) })
	r.GET("/api/v1/research/:slug", func(c *gin.Context) { researchGet(c, pool, true) })
	if tm == nil {
		return
	}
	admin := r.Group("/api/v1/admin/research")
	admin.Use(middleware.AdminSessionMiddleware(tm, checker, domain, secure), researchAdminOnly)
	admin.GET("", func(c *gin.Context) { researchList(c, pool, false) })
	admin.GET("/:id", func(c *gin.Context) { researchGet(c, pool, false) })
	admin.POST("", func(c *gin.Context) { researchSave(c, pool, false) })
	admin.PUT("/:id", func(c *gin.Context) { researchSave(c, pool, true) })
}

func researchList(c *gin.Context, pool *pgxpool.Pool, public bool) {
	q := researchSelect
	if public {
		q += " WHERE status='published'"
	}
	rows, err := pool.Query(c.Request.Context(), q+" ORDER BY created_at,id")
	if err != nil {
		researchError(c, err)
		return
	}
	defer rows.Close()
	items := []json.RawMessage{}
	for rows.Next() {
		var b json.RawMessage
		if err = rows.Scan(&b); err != nil {
			researchError(c, err)
			return
		}
		items = append(items, b)
	}
	if err = rows.Err(); err != nil {
		researchError(c, err)
		return
	}
	c.JSON(200, gin.H{"research": items})
}
