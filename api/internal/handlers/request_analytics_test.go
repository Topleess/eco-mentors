package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
)

func TestRequestAnalyticsRange(t *testing.T) {
	for _, tc := range []struct {
		start, end string
		valid      bool
	}{
		{"2026-01-01", "2026-01-01", true}, {"2024-01-01", "2024-12-31", true},
		{"2024-01-01", "2025-01-01", false}, {"2026-02-30", "2026-03-01", false},
		{"2026-02-02", "2026-02-01", false}, {"", "", false},
	} {
		a, b, err := requestAnalyticsRange(tc.start, tc.end)
		if (err == nil) != tc.valid {
			t.Fatalf("%+v: %v", tc, err)
		}
		if err == nil && (a.Location().String() != "Europe/Moscow" || b.Sub(a) < 24*time.Hour) {
			t.Fatal("not inclusive Moscow range")
		}
	}
}

type analyticsSessionChecker struct {
	role    string
	version int
	calls   int
}

func (s *analyticsSessionChecker) ModeratorSessionState(context.Context, string) (string, int, error) {
	s.calls++
	return s.role, s.version, nil
}
func TestRequestAnalyticsLiveAdminGuard(t *testing.T) {
	tm := jwt.NewTokenManager(strings.Repeat("a", 64), "analytics-test", 1)
	token, err := tm.GenerateTokenWithRole("11111111-1111-4111-8111-111111111111", 0, "admin@example.test", "Synthetic", "admin", 1)
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		role    string
		version int
		cookie  bool
		want    int
	}{{"admin", 1, false, 401}, {"moderator", 1, true, 401}, {"admin", 2, true, 401}, {"admin", 1, true, 400}} {
		checker := &analyticsSessionChecker{role: tc.role, version: tc.version}
		r := gin.New()
		RegisterRequestAnalyticsRoutes(r, nil, tm, checker, "", false)
		req := httptest.NewRequest("GET", "/api/v1/admin/analytics/requests?startDate=invalid", http.NoBody)
		if tc.cookie {
			req.AddCookie(&http.Cookie{Name: "admin_session", Value: token})
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != tc.want {
			t.Fatalf("%+v got %d %s", tc, w.Code, w.Body.String())
		}
		if tc.cookie && checker.calls != 1 {
			t.Fatal("GET did not check live session")
		}
	}
}
