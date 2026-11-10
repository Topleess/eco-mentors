package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/openmentor-io/openmentor/api/internal/middleware"
	"github.com/openmentor-io/openmentor/api/pkg/imageclass"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
	"github.com/openmentor-io/openmentor/api/pkg/s3storage"
)

type ResearchCoverStorage interface {
	UploadResearchCover(context.Context, []byte, string) (string, error)
	ReadResearchCover(context.Context, string) ([]byte, error)
}

// RegisterResearchCoverRoutes accepts the shared rate/admission middleware after auth.
func RegisterResearchCoverRoutes(r *gin.Engine, tm *jwt.TokenManager, checker middleware.AdminSessionChecker, domain string, secure bool, store ResearchCoverStorage, uploadMiddleware ...gin.HandlerFunc) {
	r.GET("/api/v1/research/covers/:id", func(c *gin.Context) { researchCoverRead(c, store) })
	if tm == nil {
		return
	}
	group := r.Group("/api/v1/admin/research")
	group.Use(middleware.AdminSessionMiddleware(tm, checker, domain, secure), researchAdminOnly)
	chain := append([]gin.HandlerFunc{}, uploadMiddleware...)
	chain = append(chain, middleware.BodySizeLimitMiddleware(middleware.MaxImageBodyBytes), func(c *gin.Context) { researchCoverUpload(c, store) })
	group.POST("/covers", chain...)
}

func researchAdminOnly(c *gin.Context) {
	session, err := middleware.GetAdminSession(c)
	if err != nil {
		c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized"})
		return
	}
	if string(session.Role) != "admin" {
		c.AbortWithStatusJSON(403, gin.H{"error": "Access denied"})
		return
	}
	c.Next()
}

func researchCoverUpload(c *gin.Context, store ResearchCoverStorage) {
	if store == nil {
		c.JSON(503, gin.H{"error": "Storage unavailable"})
		return
	}
	var v struct {
		Image       string `json:"image"`
		ContentType string `json:"contentType"`
	}
	dec := json.NewDecoder(c.Request.Body)
	if dec.Decode(&v) != nil || dec.Decode(new(interface{})) != io.EOF || !strings.HasPrefix(v.Image, "data:"+v.ContentType+";base64,") {
		c.JSON(400, gin.H{"error": "Invalid image"})
		return
	}
	data, err := s3storage.DecodeImageData(v.Image)
	if err == nil {
		err = s3storage.ValidateResearchCover(c.Request.Context(), data, v.ContentType)
	}
	if err != nil {
		code := 400
		if errors.Is(err, imageclass.ErrDecoderBusy) {
			code = 503
		}
		c.JSON(code, gin.H{"error": "Invalid or unavailable image"})
		return
	}
	id, err := store.UploadResearchCover(c.Request.Context(), data, v.ContentType)
	if err != nil || !s3storage.ValidResearchCoverID(id) {
		c.JSON(503, gin.H{"error": "Storage unavailable"})
		return
	}
	c.JSON(201, gin.H{"coverUrl": "/api/research/covers/" + id})
}

func researchCoverRead(c *gin.Context, store ResearchCoverStorage) {
	id := c.Param("id")
	if !s3storage.ValidResearchCoverID(id) || c.Request.URL.RawQuery != "" {
		c.JSON(400, gin.H{"error": "Invalid cover ID"})
		return
	}
	if store == nil {
		c.JSON(503, gin.H{"error": "Storage unavailable"})
		return
	}
	data, err := store.ReadResearchCover(c.Request.Context(), id)
	if errors.Is(err, s3storage.ErrResearchCoverNotFound) {
		c.JSON(404, gin.H{"error": "Not found"})
		return
	}
	if err != nil {
		c.JSON(503, gin.H{"error": "Storage unavailable"})
		return
	}
	contentType := http.DetectContentType(data)
	if s3storage.ValidateImage(data, contentType) != nil {
		c.JSON(503, gin.H{"error": "Invalid stored image"})
		return
	}
	c.Header("X-Content-Type-Options", "nosniff")
	c.Data(200, contentType, data)
}
