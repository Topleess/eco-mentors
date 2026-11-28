package handlers

import (
	"context"
	"errors"
	"net/mail"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openmentor-io/openmentor/api/internal/middleware"
	"github.com/openmentor-io/openmentor/api/pkg/jwt"
)

type staffAccount struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Active bool   `json:"active"`
}
type staffStore interface {
	List(context.Context) ([]staffAccount, error)
	Create(context.Context, string, int, staffAccount) error
	Update(context.Context, string, int, string, string, bool) error
}
type staffDB struct{ pool *pgxpool.Pool }

func (s staffDB) List(ctx context.Context) ([]staffAccount, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, name, COALESCE(email::text,''), CASE WHEN role = 'revoked' THEN revoked_role ELSE role END, role <> 'revoked' FROM moderators ORDER BY name,id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []staffAccount{}
	for rows.Next() {
		var a staffAccount
		if err := rows.Scan(&a.ID, &a.Name, &a.Email, &a.Role, &a.Active); err != nil {
			return nil, err
		}
		result = append(result, a)
	}
	return result, rows.Err()
}
func (s staffDB) Create(ctx context.Context, actor string, version int, a staffAccount) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // Best-effort rollback after commit or failure.
	if err := staffLockAndAuthorize(ctx, tx, actor, version); err != nil {
		return err
	}
	var id string
	if err := tx.QueryRow(ctx, `INSERT INTO moderators (name,email,role) VALUES ($1,$2,$3) RETURNING id`, a.Name, a.Email, a.Role).Scan(&id); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO staff_account_audit (actor_id, target_id, action, new_role) VALUES ($1,$2,'create',$3)`, actor, id, a.Role); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

var errStaffForbidden = errors.New("staff actor no longer admin")
var errStaffLastAdmin = errors.New("last administrator")

func staffLockAndAuthorize(ctx context.Context, tx pgx.Tx, actor string, version int) error {
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(728304918)`); err != nil {
		return err
	}
	var role string
	var currentVersion int
	if err := tx.QueryRow(ctx, `SELECT role, session_version FROM moderators WHERE id=$1 FOR UPDATE`, actor).Scan(&role, &currentVersion); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errStaffForbidden
		}
		return err
	}
	if role != staffAdminRole || !middleware.AdminSessionVersionCurrent(version, currentVersion) {
		return errStaffForbidden
	}
	return nil
}

func (s staffDB) Update(ctx context.Context, actor string, version int, id, role string, active bool) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if err := staffLockAndAuthorize(ctx, tx, actor, version); err != nil {
		return err
	}
	var oldRole string
	if err := tx.QueryRow(ctx, `SELECT role FROM moderators WHERE id=$1 FOR UPDATE`, id).Scan(&oldRole); err != nil {
		return err
	}
	if oldRole == staffAdminRole && (!active || role != staffAdminRole) {
		var count int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM moderators WHERE role='admin'`).Scan(&count); err != nil {
			return err
		}
		if count <= 1 {
			return errStaffLastAdmin
		}
	}
	newRole := role
	var savedRole any
	if !active {
		newRole = "revoked"
		savedRole = role
	}
	_, err = tx.Exec(ctx, `UPDATE moderators SET role=$2, revoked_role=$3, session_version=session_version+1, login_token=NULL, login_token_expires_at=NULL, updated_at=now() WHERE id=$1`, id, newRole, savedRole)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO staff_account_audit(actor_id,target_id,action,new_role) VALUES ($1,$2,'update',$3)`, actor, id, newRole)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func RegisterStaffRoutes(r *gin.Engine, pool *pgxpool.Pool, tm *jwt.TokenManager, checker middleware.AdminSessionChecker, domain string, secure bool) {
	registerStaffRoutes(r, staffDB{pool}, tm, checker, domain, secure)
}

const (
	staffAdminRole         = "admin"
	telegramHTTPSScheme    = "https"
	vacancyPublishedStatus = "published"
)

//nolint:gocyclo // Route validation is kept together to preserve its existing flow.
func registerStaffRoutes(r *gin.Engine, store staffStore, tm *jwt.TokenManager, checker middleware.AdminSessionChecker, domain string, secure bool) {
	if tm == nil {
		return
	}
	g := r.Group("/api/v1/admin/staff")
	g.Use(middleware.AdminSessionMiddleware(tm, checker, domain, secure), researchAdminOnly)
	g.GET("", func(c *gin.Context) {
		items, err := store.List(c.Request.Context())
		if err != nil {
			c.JSON(500, gin.H{"error": "Unable to load accounts"})
			return
		}
		c.JSON(200, gin.H{"accounts": items})
	})
	g.POST("", middleware.BodySizeLimitMiddleware(4096), func(c *gin.Context) {
		var a staffAccount
		if err := c.ShouldBindJSON(&a); err != nil {
			c.JSON(400, gin.H{"error": "Invalid account"})
			return
		}
		a.Name = strings.TrimSpace(a.Name)
		a.Email = strings.ToLower(strings.TrimSpace(a.Email))
		parsed, err := mail.ParseAddress(a.Email)
		if a.ID != "" || a.Name == "" || utf8.RuneCountInString(a.Name) > 120 || len(a.Email) > 254 || !strings.Contains(a.Email, "@") || err != nil || parsed.Address != a.Email || (a.Role != staffAdminRole && a.Role != "moderator") {
			c.JSON(400, gin.H{"error": "Invalid account"})
			return
		}
		session, err := middleware.GetAdminSession(c)
		if err != nil {
			c.JSON(401, gin.H{"error": "Unauthorized"})
			return
		}
		if err = store.Create(c.Request.Context(), session.ModeratorID, session.SessionVersion, a); err != nil {
			if errors.Is(err, errStaffForbidden) {
				c.JSON(403, gin.H{"error": "Forbidden"})
				return
			}
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				c.JSON(409, gin.H{"error": "Account already exists"})
				return
			}
			c.JSON(500, gin.H{"error": "Unable to create account"})
			return
		}
		c.JSON(201, gin.H{"ok": true})
	})
	g.PUT("/:id", middleware.BodySizeLimitMiddleware(4096), func(c *gin.Context) {
		var input struct {
			Role   string `json:"role"`
			Active *bool  `json:"active"`
		}
		if _, err := uuid.Parse(c.Param("id")); err != nil {
			c.JSON(400, gin.H{"error": "Invalid account"})
			return
		}
		if err := c.ShouldBindJSON(&input); err != nil || input.Active == nil || (input.Role != "admin" && input.Role != "moderator") {
			c.JSON(400, gin.H{"error": "Invalid account"})
			return
		}
		session, err := middleware.GetAdminSession(c)
		if err != nil {
			c.JSON(401, gin.H{"error": "Unauthorized"})
			return
		}
		err = store.Update(c.Request.Context(), session.ModeratorID, session.SessionVersion, c.Param("id"), input.Role, *input.Active)
		switch {
		case errors.Is(err, errStaffForbidden):
			c.JSON(403, gin.H{"error": "Forbidden"})
		case errors.Is(err, errStaffLastAdmin):
			c.JSON(409, gin.H{"error": "Cannot remove the last administrator"})
		case errors.Is(err, pgx.ErrNoRows):
			c.JSON(404, gin.H{"error": "Account not found"})
		case err != nil:
			c.JSON(500, gin.H{"error": "Unable to update account"})
		default:
			c.JSON(200, gin.H{"ok": true})
		}
	})
}
