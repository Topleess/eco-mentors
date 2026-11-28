package handlers

import (
	"context"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openmentor-io/openmentor/api/internal/middleware"
	"github.com/openmentor-io/openmentor/api/pkg/s3storage"
)

type MentorPhotoVisibility interface {
	PublicMentorPhoto(context.Context, string) (bool, error)
}
type MentorPhotoStorage interface {
	ReadMentorPhoto(context.Context, string) ([]byte, error)
}

type MentorPhotoDatabase struct{ Pool *pgxpool.Pool }

func (db MentorPhotoDatabase) PublicMentorPhoto(ctx context.Context, id string) (bool, error) {
	var visible bool
	err := db.Pool.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM mentors WHERE id = $1 AND status = 'active' AND deleted_at IS NULL)", id).Scan(&visible)
	return visible, err
}

func RegisterMentorPhotoRoutes(r *gin.Engine, visibility MentorPhotoVisibility, store MentorPhotoStorage, routeMiddleware ...gin.HandlerFunc) {
	chain := append([]gin.HandlerFunc{}, routeMiddleware...)
	chain = append(chain, func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.Header("X-Content-Type-Options", "nosniff")
		id := c.Param("id")
		if !s3storage.ValidResearchCoverID(id) {
			c.Status(400)
			return
		}
		if visibility == nil || store == nil {
			c.Status(503)
			return
		}
		visible, err := visibility.PublicMentorPhoto(c.Request.Context(), id)
		if err != nil {
			c.Status(503)
			return
		}
		if !visible {
			c.Status(404)
			return
		}
		data, err := store.ReadMentorPhoto(c.Request.Context(), id)
		if errors.Is(err, s3storage.ErrMentorPhotoNotFound) {
			c.Status(404)
			return
		}
		if err != nil {
			c.Status(503)
			return
		}
		c.Data(200, http.DetectContentType(data), data)
	})
	r.GET("/api/v1/mentor-photos/:id", chain...)
}

// MentorOwnPhoto derives the key from the authenticated session, never the URL.
func MentorOwnPhoto(store MentorPhotoStorage) gin.HandlerFunc {
	return func(c *gin.Context) {
		session, err := middleware.GetMentorSession(c)
		if err != nil {
			c.Status(http.StatusUnauthorized)
			return
		}
		servePrivateMentorPhoto(c, store, session.MentorID)
	}
}

// AdminMentorPhoto must be registered behind live admin session middleware.
func AdminMentorPhoto(store MentorPhotoStorage) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := middleware.GetAdminSession(c); err != nil {
			c.Status(http.StatusUnauthorized)
			return
		}
		servePrivateMentorPhoto(c, store, c.Param("id"))
	}
}

func servePrivateMentorPhoto(c *gin.Context, store MentorPhotoStorage, id string) {
	c.Header("Cache-Control", "no-store")
	c.Header("X-Content-Type-Options", "nosniff")
	if !s3storage.ValidResearchCoverID(id) {
		c.Status(400)
		return
	}
	if store == nil {
		c.Status(503)
		return
	}
	data, err := store.ReadMentorPhoto(c.Request.Context(), id)
	if errors.Is(err, s3storage.ErrMentorPhotoNotFound) {
		c.Status(404)
		return
	}
	if err != nil {
		c.Status(503)
		return
	}
	c.Data(200, http.DetectContentType(data), data)
}
