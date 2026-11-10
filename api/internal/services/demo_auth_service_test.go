package services

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/openmentor-io/openmentor/api/internal/models"
	"github.com/openmentor-io/openmentor/api/internal/repository"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
)

type demoMentorRepositoryStub struct {
	mentor         *models.Mentor
	lookupEmail    string
	currentStatus  string
	sessionVersion int
	stateErr       error
}

func (r demoMentorRepositoryStub) GetByEmail(_ context.Context, email string) (*models.Mentor, error) {
	if r.mentor == nil || !strings.EqualFold(r.lookupEmail, email) {
		return nil, pgx.ErrNoRows
	}
	return r.mentor, nil
}

func (r demoMentorRepositoryStub) MentorSessionState(_ context.Context, mentorID string) (string, int, error) {
	if r.stateErr != nil {
		return "", 0, r.stateErr
	}
	if r.mentor == nil || r.mentor.MentorID != mentorID {
		return "", 0, errors.New("not found")
	}
	return r.currentStatus, r.sessionVersion, nil
}

type demoModeratorRepositoryStub struct {
	moderator      *models.Moderator
	currentRole    string
	sessionVersion int
	stateErr       error
}

func (r demoModeratorRepositoryStub) GetByEmail(_ context.Context, email string) (*models.Moderator, error) {
	if r.moderator == nil || !strings.EqualFold(r.moderator.Email, email) {
		return nil, pgx.ErrNoRows
	}
	return r.moderator, nil
}

func (r demoModeratorRepositoryStub) ModeratorSessionState(_ context.Context, moderatorID string) (string, int, error) {
	if r.stateErr != nil {
		return "", 0, r.stateErr
	}
	if r.moderator == nil || r.moderator.ID != moderatorID {
		return "", 0, errors.New("not found")
	}
	return r.currentRole, r.sessionVersion, nil
}

func newDemoAuthServiceForTest(enabled bool, mentor *models.Mentor, mentorStatus string, moderator *models.Moderator, moderatorRole string) (*DemoAuthService, *jwt.TokenManager) {
	tokenManager := jwt.NewTokenManager("test-signing-secret-at-least-32-bytes-long", "openmentor-api", 24)
	service := NewDemoAuthService(
		enabled,
		demoMentorRepositoryStub{mentor: mentor, lookupEmail: DemoMentorEmail, currentStatus: mentorStatus, sessionVersion: 7},
		demoModeratorRepositoryStub{moderator: moderator, currentRole: moderatorRole, sessionVersion: 4},
		tokenManager,
		24,
	)
	return service, tokenManager
}

func TestDemoLoginMintsAdminSessionOnlyForSeededAdminEmail(t *testing.T) {
	moderator := &models.Moderator{
		ID:    uuid.NewString(),
		Name:  "Demo Moderator",
		Email: DemoAdminEmail,
		Role:  models.ModeratorRoleAdmin,
	}
	service, tokenManager := newDemoAuthServiceForTest(true, nil, "", moderator, "admin")

	result, err := service.Login(context.Background(), "  "+strings.ToUpper(DemoAdminEmail)+"  ")
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	if result.Role != DemoRoleAdmin || result.AdminSession == nil || result.MentorSession != nil {
		t.Fatalf("Login() result = %#v, want admin session only", result)
	}
	claims, err := tokenManager.ValidateAdminToken(result.Token)
	if err != nil {
		t.Fatalf("ValidateAdminToken() error = %v", err)
	}
	if claims.Subject != moderator.ID || claims.Email != DemoAdminEmail || claims.Role != "admin" || claims.SessionVersion != 4 {
		t.Fatalf("admin claims = %#v", claims)
	}
}

func TestDemoLoginMintsMentorSessionOnlyForSeededActiveMentor(t *testing.T) {
	mentor := &models.Mentor{
		MentorID: uuid.NewString(),
		LegacyID: 42,
		Name:     "Demo Mentor",
		Status:   "active",
	}
	service, tokenManager := newDemoAuthServiceForTest(true, mentor, "active", nil, "")

	result, err := service.Login(context.Background(), DemoMentorEmail)
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	if result.Role != DemoRoleMentor || result.MentorSession == nil || result.AdminSession != nil {
		t.Fatalf("Login() result = %#v, want mentor session only", result)
	}
	claims, err := tokenManager.ValidateMentorToken(result.Token)
	if err != nil {
		t.Fatalf("ValidateMentorToken() error = %v", err)
	}
	if claims.Subject != mentor.MentorID || claims.Email != DemoMentorEmail || claims.SessionVersion != 7 {
		t.Fatalf("mentor claims = %#v", claims)
	}
}

func TestDemoLoginRejectsDisabledOrUnseededIdentity(t *testing.T) {
	moderator := &models.Moderator{ID: uuid.NewString(), Email: DemoAdminEmail, Role: models.ModeratorRoleAdmin}
	service, _ := newDemoAuthServiceForTest(false, nil, "", moderator, "admin")
	if _, err := service.Login(context.Background(), DemoAdminEmail); !errors.Is(err, ErrDemoLoginUnavailable) {
		t.Fatalf("disabled Login() error = %v, want ErrDemoLoginUnavailable", err)
	}

	service, _ = newDemoAuthServiceForTest(true, nil, "", moderator, "admin")
	if _, err := service.Login(context.Background(), "visitor@example.com"); !errors.Is(err, ErrDemoLoginDenied) {
		t.Fatalf("unseeded Login() error = %v, want ErrDemoLoginDenied", err)
	}
}

func TestDemoLoginRejectsIneligibleOrMismatchedSeededAccounts(t *testing.T) {
	mentor := &models.Mentor{
		MentorID: uuid.NewString(),
		LegacyID: 42,
		Name:     "Demo Mentor",
		Status:   "active",
	}
	service, _ := newDemoAuthServiceForTest(true, mentor, "declined", nil, "")
	if _, err := service.Login(context.Background(), DemoMentorEmail); !errors.Is(err, ErrDemoLoginDenied) {
		t.Fatalf("declined mentor Login() error = %v, want ErrDemoLoginDenied", err)
	}

	moderator := &models.Moderator{
		ID:    uuid.NewString(),
		Name:  "Demo Moderator",
		Email: DemoAdminEmail,
		Role:  models.ModeratorRoleAdmin,
	}
	service, _ = newDemoAuthServiceForTest(true, nil, "", moderator, "moderator")
	if _, err := service.Login(context.Background(), DemoAdminEmail); !errors.Is(err, ErrDemoLoginDenied) {
		t.Fatalf("mismatched moderator Login() error = %v, want ErrDemoLoginDenied", err)
	}
}

func TestDemoLoginDeniesSubjectsGoneDuringSessionStateLookup(t *testing.T) {
	mentor := &models.Mentor{MentorID: uuid.NewString(), LegacyID: 42, Name: "Demo Mentor", Status: "active"}
	moderator := &models.Moderator{ID: uuid.NewString(), Name: "Demo Moderator", Email: DemoAdminEmail, Role: models.ModeratorRoleAdmin}
	tokenManager := jwt.NewTokenManager("test-signing-secret-at-least-32-bytes-long", "openmentor-api", 24)

	t.Run("mentor", func(t *testing.T) {
		service := NewDemoAuthService(
			true,
			demoMentorRepositoryStub{mentor: mentor, lookupEmail: DemoMentorEmail, stateErr: repository.ErrSessionSubjectGone},
			demoModeratorRepositoryStub{moderator: moderator},
			tokenManager,
			24,
		)
		if _, err := service.Login(context.Background(), DemoMentorEmail); !errors.Is(err, ErrDemoLoginDenied) {
			t.Fatalf("mentor Login() error = %v, want ErrDemoLoginDenied", err)
		}
	})

	t.Run("moderator", func(t *testing.T) {
		service := NewDemoAuthService(
			true,
			demoMentorRepositoryStub{mentor: mentor},
			demoModeratorRepositoryStub{moderator: moderator, stateErr: repository.ErrSessionSubjectGone},
			tokenManager,
			24,
		)
		if _, err := service.Login(context.Background(), DemoAdminEmail); !errors.Is(err, ErrDemoLoginDenied) {
			t.Fatalf("moderator Login() error = %v, want ErrDemoLoginDenied", err)
		}
	})
}
