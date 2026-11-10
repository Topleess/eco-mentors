package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openmentor-io/openmentor/api/internal/middleware"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
)

func requestAnalyticsRange(start, end string) (time.Time, time.Time, error) {
	loc, err := time.LoadLocation("Europe/Moscow")
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	a, err := time.ParseInLocation(time.DateOnly, start, loc)
	if err != nil {
		return a, a, err
	}
	b, err := time.ParseInLocation(time.DateOnly, end, loc)
	if err != nil {
		return a, b, err
	}
	b = b.AddDate(0, 0, 1)
	if !b.After(a) || b.Sub(a) > 366*24*time.Hour {
		return a, b, fmt.Errorf("range must contain 1 to 366 days")
	}
	return a, b, nil
}

func RegisterRequestAnalyticsRoutes(r *gin.Engine, pool *pgxpool.Pool, tm *jwt.TokenManager, checker middleware.AdminSessionChecker, domain string, secure bool) {
	if tm == nil {
		return
	}
	g := r.Group("/api/v1/admin/analytics")
	g.Use(middleware.AdminSessionMiddleware(tm, checker, domain, secure), researchAdminOnly)
	g.GET("/requests", func(c *gin.Context) {
		a, b, err := requestAnalyticsRange(c.Query("startDate"), c.Query("endDate"))
		if err != nil {
			c.JSON(400, gin.H{"error": "startDate and endDate must be valid dates spanning 1 to 366 inclusive days"})
			return
		}
		result, err := readRequestAnalytics(c.Request.Context(), pool, a, b)
		if err != nil {
			researchError(c, err)
			return
		}
		c.Header("Cache-Control", "no-store")
		c.Data(200, "application/json", result)
	})
}

func readRequestAnalytics(ctx context.Context, pool *pgxpool.Pool, a, b time.Time) (json.RawMessage, error) {
	tx, err := pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }() //nolint:errcheck // no-op after commit
	var result json.RawMessage
	err = tx.QueryRow(ctx, requestAnalyticsSQL, a, b).Scan(&result)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return result, nil
}
