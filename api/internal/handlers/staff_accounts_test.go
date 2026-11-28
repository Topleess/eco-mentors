package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
	"github.com/stretchr/testify/require"
)

type staffFake struct{ created int }

func (f *staffFake) List(context.Context) ([]staffAccount, error) { return []staffAccount{}, nil }
func (f *staffFake) Create(_ context.Context, actor string, version int, a staffAccount) error {
	f.created++
	return nil
}
func (f *staffFake) Update(context.Context, string, int, string, string, bool) error { return nil }
func TestStaffAccountsAccessAndValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tm := jwt.NewTokenManager("test-secret", "test", 1)
	f := &staffFake{}
	r := gin.New()
	registerStaffRoutes(r, f, tm, nil, "", false)
	request := func(role, body string) int {
		req := httptest.NewRequest("POST", "/api/v1/admin/staff", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if role != "" {
			token, err := tm.GenerateTokenWithRole(uuid.NewString(), 0, "", "", role, 0)
			require.NoError(t, err)
			req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}
	valid := `{"name":"Test User","email":"test@example.invalid","role":"moderator"}`
	require.Equal(t, 401, request("", valid))
	require.Equal(t, 403, request("moderator", valid))
	require.Equal(t, 400, request("admin", `{"name":"Test","email":"bad","role":"admin"}`))
	require.Equal(t, 400, request("admin", `{"name":"Test","email":"x@example.invalid","role":"owner"}`))
	require.Equal(t, 201, request("admin", valid))
	require.Equal(t, 1, f.created)
}

func TestStaffRoleChangeRequiresAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tm := jwt.NewTokenManager("test-secret", "test", 1)
	f := &staffFake{}
	r := gin.New()
	registerStaffRoutes(r, f, tm, nil, "", false)
	request := func(role string) int {
		req := httptest.NewRequest("PUT", "/api/v1/admin/staff/"+uuid.NewString(), strings.NewReader(`{"role":"moderator","active":true}`))
		req.Header.Set("Content-Type", "application/json")
		token, err := tm.GenerateTokenWithRole(uuid.NewString(), 0, "", "", role, 1)
		require.NoError(t, err)
		req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}
	require.Equal(t, 403, request("moderator"))
	require.Equal(t, 200, request("admin"))
}
