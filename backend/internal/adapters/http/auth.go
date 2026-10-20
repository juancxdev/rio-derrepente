package httpadapter

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/adapters/auth"
	"github.com/juancx/tourism-platform/backend/internal/adapters/postgres"
	"github.com/juancx/tourism-platform/backend/internal/application"
	"github.com/juancx/tourism-platform/backend/internal/domain/identity"
	"github.com/juancx/tourism-platform/backend/internal/domain/sites"
)

type authError struct {
	status  int
	code    string
	message string
}

func (e *authError) Error() string { return e.message }

type sessionResponse struct {
	AccessToken string              `json:"access_token,omitempty"`
	User        identity.User       `json:"user"`
	Tenant      identity.Membership `json:"tenant"`
	Sites       []sites.Site        `json:"sites"`
	ClosureHour int                 `json:"closure_hour"`
}

func (a *API) sessionResponse(session application.Session) sessionResponse {
	list := session.Sites
	if list == nil {
		list = []sites.Site{}
	}
	return sessionResponse{
		AccessToken: session.AccessToken,
		User:        session.User,
		Tenant:      session.Tenant,
		Sites:       list,
		ClosureHour: a.closureHour,
	}
}

func (a *API) requireAuthService() error {
	if a.auth == nil || a.tokens == nil {
		return fiber.NewError(fiber.StatusServiceUnavailable, "auth service unavailable")
	}
	return nil
}

func (a *API) login(c *fiber.Ctx) error {
	if err := a.requireAuthService(); err != nil {
		return err
	}
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "invalid JSON")
	}
	session, err := a.auth.Login(c.Context(), req.Email, req.Password)
	switch {
	case errors.Is(err, identity.ErrInvalidCredentials):
		return &authError{401, "invalid_credentials", "Correo o contraseña incorrectos."}
	case errors.Is(err, identity.ErrInactiveUser):
		return &authError{403, "inactive_user", "La cuenta está desactivada."}
	case errors.Is(err, identity.ErrMembershipNotFound):
		return &authError{403, "forbidden", "La cuenta no tiene acceso a ningún tenant."}
	case err != nil:
		return err
	}
	return c.JSON(a.sessionResponse(session))
}

func (a *API) me(c *fiber.Ctx) error {
	if err := a.requireAuthService(); err != nil {
		return err
	}
	userID, _ := c.Locals(localsUserID).(uuid.UUID)
	tenantID, _ := c.Locals(localsTenantID).(uuid.UUID)
	session, err := a.auth.Session(c.Context(), userID, tenantID)
	if err != nil {
		return err
	}
	return c.JSON(a.sessionResponse(session))
}

// Logout is intentionally stateless: the client discards the in-memory token.
// Revocation of already signed tokens belongs to a later iteration.
func (a *API) logout(c *fiber.Ctx) error {
	return c.SendStatus(fiber.StatusNoContent)
}

func (a *API) RequireAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if err := a.requireAuthService(); err != nil {
			return err
		}
		header := strings.TrimSpace(c.Get(fiber.HeaderAuthorization))
		scheme, token, ok := strings.Cut(header, " ")
		if !ok || !strings.EqualFold(scheme, "Bearer") || strings.TrimSpace(token) == "" {
			return &authError{401, "missing_token", "Se requiere una sesión autenticada."}
		}
		claims, err := a.tokens.Parse(strings.TrimSpace(token))
		if err != nil {
			if errors.Is(err, auth.ErrTokenExpired) {
				return &authError{401, "token_expired", "La sesión venció. Inicia sesión nuevamente."}
			}
			return &authError{401, "invalid_token", "El token de sesión no es válido."}
		}
		user, membership, err := a.auth.Authenticate(c.Context(), claims.UserID, claims.TenantID)
		switch {
		case errors.Is(err, identity.ErrInactiveUser):
			return &authError{403, "inactive_user", "La cuenta está desactivada."}
		case errors.Is(err, identity.ErrUserNotFound), errors.Is(err, identity.ErrMembershipNotFound):
			return &authError{401, "invalid_token", "El token de sesión no es válido."}
		case err != nil:
			return err
		}
		c.Locals(localsUserID, user.ID)
		c.Locals(localsTenantID, membership.TenantID)
		c.Locals(localsRole, membership.Role)
		c.Locals(localsUser, user)
		return c.Next()
	}
}

// RequireSuperAdmin gates the platform console. It reads the authenticated
// user loaded by RequireAuth, so a token alone is not enough: the account must
// still be flagged as a platform administrator in the database.
func (a *API) RequireSuperAdmin() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user, ok := c.Locals(localsUser).(identity.User)
		if !ok {
			return &authError{401, "missing_token", "Se requiere una sesión autenticada."}
		}
		if !user.IsSuperAdmin {
			return &authError{403, "forbidden", "Solo el super administrador puede acceder a esta sección."}
		}
		return c.Next()
	}
}

func (a *API) RequireRole(required identity.Role) fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, ok := c.Locals(localsRole).(identity.Role)
		if !ok {
			return &authError{401, "missing_token", "Se requiere una sesión autenticada."}
		}
		if !role.Allows(required) {
			return &authError{403, "forbidden", "El rol actual no permite esta operación."}
		}
		return c.Next()
	}
}

// RequireTenantParam keeps the tenant in the URL for readability while the
// token stays the source of authority. A mismatching tenant is a 404 so the
// API never reveals that another tenant exists.
func (a *API) RequireTenantParam() fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID, ok := c.Locals(localsTenantID).(uuid.UUID)
		if !ok {
			return &authError{401, "missing_token", "Se requiere una sesión autenticada."}
		}
		pathTenant, err := uuid.Parse(c.Params("tenantID"))
		if err != nil {
			return fiber.NewError(fiber.StatusUnprocessableEntity, "invalid tenant_id")
		}
		if pathTenant != tenantID {
			return postgres.ErrScopeNotFound
		}
		return c.Next()
	}
}

func (a *API) legacySite(c *fiber.Ctx) error {
	if err := a.requireTicketing(); err != nil {
		return err
	}
	tenantID, ok := c.Locals(localsTenantID).(uuid.UUID)
	if !ok {
		return &authError{401, "missing_token", "Se requiere una sesión autenticada."}
	}
	siteID, err := uuid.Parse(c.Params("siteID"))
	if err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "invalid site_id")
	}
	if !a.ticketing.OwnsSite(c.Context(), tenantID, siteID) {
		return postgres.ErrScopeNotFound
	}
	return c.Next()
}
