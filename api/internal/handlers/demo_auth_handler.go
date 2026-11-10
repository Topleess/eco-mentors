package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/openmentor-io/openmentor/api/internal/middleware"
	"github.com/openmentor-io/openmentor/api/internal/services"
)

type DemoAuthHandler struct {
	service      services.DemoAuthServiceInterface
	sessionTTL   int
	cookieDomain string
	cookieSecure bool
}

func NewDemoAuthHandler(service services.DemoAuthServiceInterface, sessionTTL int, cookieDomain string, cookieSecure bool) *DemoAuthHandler {
	return &DemoAuthHandler{
		service:      service,
		sessionTTL:   sessionTTL,
		cookieDomain: cookieDomain,
		cookieSecure: cookieSecure,
	}
}

func (h *DemoAuthHandler) Login(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email,max=255"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "Invalid email format", err)
		return
	}

	result, err := h.service.Login(c.Request.Context(), req.Email)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrDemoLoginUnavailable):
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Demo login is not available"})
		case errors.Is(err, services.ErrDemoLoginDenied):
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Demo account is unavailable"})
		default:
			respondError(c, http.StatusInternalServerError, "Demo login failed", err)
		}
		return
	}

	switch result.Role {
	case services.DemoRoleAdmin:
		if result.AdminSession == nil || result.Token == "" {
			respondError(c, http.StatusInternalServerError, "Demo login failed", errors.New("incomplete admin demo session"))
			return
		}
		middleware.SetAdminSessionCookie(c, result.Token, h.sessionTTL, h.cookieDomain, h.cookieSecure)
		c.JSON(http.StatusOK, gin.H{"success": true, "role": result.Role, "session": result.AdminSession})
	case services.DemoRoleMentor:
		if result.MentorSession == nil || result.Token == "" {
			respondError(c, http.StatusInternalServerError, "Demo login failed", errors.New("incomplete mentor demo session"))
			return
		}
		middleware.SetSessionCookie(c, result.Token, h.sessionTTL, h.cookieDomain, h.cookieSecure)
		c.JSON(http.StatusOK, gin.H{"success": true, "role": result.Role, "session": result.MentorSession})
	default:
		respondError(c, http.StatusInternalServerError, "Demo login failed", errors.New("unknown demo session realm"))
	}
}
