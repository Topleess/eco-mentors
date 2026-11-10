package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/openmentor-io/openmentor/api/internal/models"
	"github.com/openmentor-io/openmentor/api/internal/repository"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
)

const (
	DemoAdminEmail  = "demo-admin@openmentor.test"
	DemoMentorEmail = "demo-mentor@openmentor.test"
	DemoRoleAdmin   = "admin"
	DemoRoleMentor  = "mentor"
)

var (
	ErrDemoLoginUnavailable = errors.New("demo login is unavailable")
	ErrDemoLoginDenied      = errors.New("demo login is not allowed for this identity")
)

type demoMentorLookup interface {
	GetByEmail(ctx context.Context, email string) (*models.Mentor, error)
	MentorSessionState(ctx context.Context, mentorID string) (status string, sessionVersion int, err error)
}

type demoModeratorLookup interface {
	GetByEmail(ctx context.Context, email string) (*models.Moderator, error)
	ModeratorSessionState(ctx context.Context, moderatorID string) (role string, sessionVersion int, err error)
}

type DemoLoginResult struct {
	Role          string                `json:"role"`
	Token         string                `json:"-"`
	MentorSession *models.MentorSession `json:"mentorSession,omitempty"`
	AdminSession  *models.AdminSession  `json:"adminSession,omitempty"`
}

type DemoAuthService struct {
	enabled      bool
	mentors      demoMentorLookup
	moderators   demoModeratorLookup
	tokenManager *jwt.TokenManager
	sessionTTL   time.Duration
}

func NewDemoAuthService(
	enabled bool,
	mentors demoMentorLookup,
	moderators demoModeratorLookup,
	tokenManager *jwt.TokenManager,
	sessionTTLHours int,
) *DemoAuthService {

	return &DemoAuthService{
		enabled:      enabled,
		mentors:      mentors,
		moderators:   moderators,
		tokenManager: tokenManager,
		sessionTTL:   time.Duration(sessionTTLHours) * time.Hour,
	}
}

func (s *DemoAuthService) Login(ctx context.Context, email string) (*DemoLoginResult, error) {
	if !s.enabled {
		return nil, ErrDemoLoginUnavailable
	}

	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	switch normalizedEmail {
	case DemoAdminEmail:
		return s.loginAdmin(ctx, normalizedEmail)
	case DemoMentorEmail:
		return s.loginMentor(ctx, normalizedEmail)
	default:
		return nil, ErrDemoLoginDenied
	}
}

func (s *DemoAuthService) loginAdmin(ctx context.Context, email string) (*DemoLoginResult, error) {
	moderator, err := s.moderators.GetByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) || moderator == nil {
		return nil, ErrDemoLoginDenied
	}
	if err != nil {
		return nil, fmt.Errorf("demo moderator lookup failed: %w", err)
	}
	if moderator.Role != models.ModeratorRoleAdmin {
		return nil, ErrDemoLoginDenied
	}

	currentRole, sessionVersion, err := s.moderators.ModeratorSessionState(ctx, moderator.ID)
	if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, repository.ErrSessionSubjectGone) {
		return nil, ErrDemoLoginDenied
	}
	if err != nil {
		return nil, fmt.Errorf("demo moderator session lookup failed: %w", err)
	}
	if currentRole != string(models.ModeratorRoleAdmin) {
		return nil, ErrDemoLoginDenied
	}

	token, err := s.tokenManager.GenerateTokenWithRole(moderator.ID, 0, email, moderator.Name, currentRole, sessionVersion)
	if err != nil {
		return nil, fmt.Errorf("generate demo moderator session: %w", err)
	}
	now := time.Now().Unix()
	return &DemoLoginResult{
		Role:  DemoRoleAdmin,
		Token: token,
		AdminSession: &models.AdminSession{
			ModeratorID: moderator.ID,
			Email:       email,
			Name:        moderator.Name,
			Role:        models.ModeratorRoleAdmin,
			IssuedAt:    now,
			ExpiresAt:   now + int64(s.sessionTTL.Seconds()),
		},
	}, nil
}

func (s *DemoAuthService) loginMentor(ctx context.Context, email string) (*DemoLoginResult, error) {
	mentor, err := s.mentors.GetByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) || mentor == nil {
		return nil, ErrDemoLoginDenied
	}
	if err != nil {
		return nil, fmt.Errorf("demo mentor lookup failed: %w", err)
	}

	status, sessionVersion, err := s.mentors.MentorSessionState(ctx, mentor.MentorID)
	if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, repository.ErrSessionSubjectGone) {
		return nil, ErrDemoLoginDenied
	}
	if err != nil {
		return nil, fmt.Errorf("demo mentor session lookup failed: %w", err)
	}
	if status != "active" {
		return nil, ErrDemoLoginDenied
	}

	token, err := s.tokenManager.GenerateToken(mentor.MentorID, mentor.LegacyID, email, mentor.Name, sessionVersion)
	if err != nil {
		return nil, fmt.Errorf("generate demo mentor session: %w", err)
	}
	now := time.Now().Unix()
	return &DemoLoginResult{
		Role:  DemoRoleMentor,
		Token: token,
		MentorSession: &models.MentorSession{
			LegacyID:  mentor.LegacyID,
			MentorID:  mentor.MentorID,
			Email:     email,
			Name:      mentor.Name,
			IssuedAt:  now,
			ExpiresAt: now + int64(s.sessionTTL.Seconds()),
		},
	}, nil
}
