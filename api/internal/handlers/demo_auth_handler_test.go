package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/openmentor-io/openmentor/api/internal/models"
	"github.com/openmentor-io/openmentor/api/internal/services"
)

type demoAuthServiceStub struct {
	result *services.DemoLoginResult
	err    error
}

func (s demoAuthServiceStub) Login(context.Context, string) (*services.DemoLoginResult, error) {
	return s.result, s.err
}

func TestDemoAuthHandlerSetsRealmCookieWithoutReturningBearerToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name       string
		result     *services.DemoLoginResult
		cookieName string
	}{
		{
			name: "mentor",
			result: &services.DemoLoginResult{
				Role:  services.DemoRoleMentor,
				Token: "secret-mentor-bearer",
				MentorSession: &models.MentorSession{
					MentorID: "mentor-id",
					Email:    services.DemoMentorEmail,
					Name:     "Demo Mentor",
				},
			},
			cookieName: "mentor_session",
		},
		{
			name: "admin",
			result: &services.DemoLoginResult{
				Role:  services.DemoRoleAdmin,
				Token: "secret-admin-bearer",
				AdminSession: &models.AdminSession{
					ModeratorID: "moderator-id",
					Email:       services.DemoAdminEmail,
					Name:        "Demo Moderator",
					Role:        models.ModeratorRoleAdmin,
				},
			},
			cookieName: "admin_session",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			handler := NewDemoAuthHandler(demoAuthServiceStub{result: tt.result}, 3600, "", true)
			router.POST("/api/v1/demo/login", handler.Login)
			request := httptest.NewRequest(http.MethodPost, "/api/v1/demo/login", strings.NewReader(`{"email":"demo@example.test"}`))
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d; body=%s", response.Code, http.StatusOK, response.Body.String())
			}
			setCookie := response.Header().Get("Set-Cookie")
			if !strings.Contains(setCookie, tt.cookieName+"=") || !strings.Contains(setCookie, "HttpOnly") || !strings.Contains(setCookie, "Secure") {
				t.Fatalf("Set-Cookie = %q, want secure httpOnly %s cookie", setCookie, tt.cookieName)
			}
			if strings.Contains(response.Body.String(), "secret-") || strings.Contains(response.Body.String(), `"token"`) {
				t.Fatalf("response leaked bearer token: %s", response.Body.String())
			}
		})
	}
}

func TestDemoAuthHandlerDoesNotRevealDeniedEmail(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := NewDemoAuthHandler(demoAuthServiceStub{err: services.ErrDemoLoginDenied}, 3600, "", true)
	router.POST("/api/v1/demo/login", handler.Login)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/demo/login", strings.NewReader(`{"email":"not-a-demo@example.test"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
	if strings.Contains(response.Body.String(), "not-a-demo@example.test") {
		t.Fatalf("response reflected denied email: %s", response.Body.String())
	}
}

func TestDemoAuthHandlerHidesUnavailableRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := NewDemoAuthHandler(demoAuthServiceStub{err: services.ErrDemoLoginUnavailable}, 3600, "", true)
	router.POST("/api/v1/demo/login", handler.Login)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/demo/login", strings.NewReader(`{"email":"demo-admin@openmentor.test"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusNotFound)
	}
	if strings.Contains(response.Body.String(), "demo-admin@openmentor.test") {
		t.Fatalf("response reflected demo email: %s", response.Body.String())
	}
}
