package middleware

import (
	"net/http"
	"testing"
)

func TestLegacyAdminSessionOnlyValidAtOriginalVersion(t *testing.T) {
	for _, tc := range []struct{ version, want int }{{1, http.StatusOK}, {2, http.StatusUnauthorized}, {3, http.StatusUnauthorized}} {
		mw := AdminSessionMiddleware(testTokenManager(), &stubChecker{role: "admin", version: tc.version}, "", false)
		rec := run(t, mw, http.MethodGet, AdminSessionCookieName, adminToken(t, "admin", 0))
		if rec.Code != tc.want {
			t.Errorf("version %d: got %d, want %d", tc.version, rec.Code, tc.want)
		}
	}
}
