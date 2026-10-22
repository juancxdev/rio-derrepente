package application

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/domain/identity"
	"github.com/juancx/tourism-platform/backend/internal/domain/sites"
)

// IdentityRepository is the persistence port for users and memberships.
type IdentityRepository interface {
	FindUserByEmail(context.Context, string) (identity.User, error)
	FindUserByID(context.Context, uuid.UUID) (identity.User, error)
	Memberships(context.Context, uuid.UUID) ([]identity.Membership, error)
	Membership(context.Context, uuid.UUID, uuid.UUID) (identity.Membership, error)
	UpsertUser(context.Context, identity.User) (identity.User, error)
	UpsertMembership(context.Context, identity.Membership) error
}

type PasswordService interface {
	Hash(string) (string, error)
	Verify(hash, plain string) bool
}

type TokenService interface {
	Issue(identity.Claims) (string, error)
	Parse(string) (identity.Claims, error)
}

// SiteLister is the tenant-scoped destination lookup used to hydrate a session.
type SiteLister interface {
	ListSites(context.Context, uuid.UUID) ([]sites.Site, error)
}

type AuthService struct {
	repo      IdentityRepository
	sites     SiteLister
	passwords PasswordService
	tokens    TokenService
	tokenTTL  time.Duration
}

type Session struct {
	User        identity.User
	Tenant      identity.Membership
	Sites       []sites.Site
	AccessToken string
}

func NewAuthService(repo IdentityRepository, sites SiteLister, passwords PasswordService, tokens TokenService, tokenTTL time.Duration) AuthService {
	if tokenTTL <= 0 {
		tokenTTL = 8 * time.Hour
	}
	return AuthService{repo: repo, sites: sites, passwords: passwords, tokens: tokens, tokenTTL: tokenTTL}
}

// Login validates the password and returns a signed session bound to the
// user's first tenant membership.
func (s AuthService) Login(ctx context.Context, email, password string) (Session, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || password == "" {
		return Session{}, identity.ErrInvalidCredentials
	}
	user, err := s.repo.FindUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, identity.ErrUserNotFound) {
			return Session{}, identity.ErrInvalidCredentials
		}
		return Session{}, err
	}
	if !s.passwords.Verify(user.PasswordHash, password) {
		return Session{}, identity.ErrInvalidCredentials
	}
	if !user.Active {
		return Session{}, identity.ErrInactiveUser
	}
	if user.IsSuperAdmin {
		return s.superAdminSession(user, "")
	}
	memberships, err := s.repo.Memberships(ctx, user.ID)
	if err != nil {
		return Session{}, err
	}
	if len(memberships) == 0 {
		return Session{}, identity.ErrMembershipNotFound
	}
	tenant := memberships[0]
	token, err := s.tokens.Issue(identity.Claims{
		UserID:    user.ID,
		TenantID:  tenant.TenantID,
		Role:      tenant.Role,
		ExpiresAt: time.Now().Add(s.tokenTTL).Unix(),
	})
	if err != nil {
		return Session{}, err
	}
	session := Session{User: user, Tenant: tenant, AccessToken: token}
	if s.sites != nil {
		session.Sites, err = s.sites.ListSites(ctx, tenant.TenantID)
		if err != nil {
			return Session{}, err
		}
	}
	return session, nil
}

// Session rebuilds the current session for GET /auth/me.
func (s AuthService) Session(ctx context.Context, userID, tenantID uuid.UUID) (Session, error) {
	user, tenant, err := s.Authenticate(ctx, userID, tenantID)
	if err != nil {
		return Session{}, err
	}
	if user.IsSuperAdmin {
		return s.superAdminSession(user, "")
	}
	token, err := s.tokens.Issue(identity.Claims{
		UserID:    user.ID,
		TenantID:  tenant.TenantID,
		Role:      tenant.Role,
		ExpiresAt: time.Now().Add(s.tokenTTL).Unix(),
	})
	if err != nil {
		return Session{}, err
	}
	session := Session{User: user, Tenant: tenant, AccessToken: token}
	if s.sites != nil {
		session.Sites, err = s.sites.ListSites(ctx, tenantID)
		if err != nil {
			return Session{}, err
		}
	}
	return session, nil
}

// Authenticate is used by the auth middleware on every protected request:
// the user must still exist, be active and belong to the token tenant.
func (s AuthService) Authenticate(ctx context.Context, userID, tenantID uuid.UUID) (identity.User, identity.Membership, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, identity.ErrUserNotFound) {
			return identity.User{}, identity.Membership{}, identity.ErrUserNotFound
		}
		return identity.User{}, identity.Membership{}, err
	}
	if !user.Active {
		return identity.User{}, identity.Membership{}, identity.ErrInactiveUser
	}
	if user.IsSuperAdmin {
		return user, platformMembership(), nil
	}
	membership, err := s.repo.Membership(ctx, userID, tenantID)
	if err != nil {
		return identity.User{}, identity.Membership{}, err
	}
	return user, membership, nil
}

// EnsureDemoUser creates or refreshes the controlled demo account. It must only
// be called when APP_SEED_DEMO=true.
func (s AuthService) EnsureDemoUser(ctx context.Context, email, password, displayName string, tenantID uuid.UUID, role identity.Role) (identity.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	displayName = strings.TrimSpace(displayName)
	if email == "" || len(password) < 8 || displayName == "" {
		return identity.User{}, identity.ErrInvalidUser
	}
	if !role.ValidTenantRole() {
		role = identity.RoleManager
	}
	hash, err := s.passwords.Hash(password)
	if err != nil {
		return identity.User{}, err
	}
	user, err := s.repo.UpsertUser(ctx, identity.User{
		ID:           uuid.New(),
		Email:        email,
		DisplayName:  displayName,
		PasswordHash: hash,
		Active:       true,
	})
	if err != nil {
		return identity.User{}, err
	}
	if err := s.repo.UpsertMembership(ctx, identity.Membership{
		UserID:   user.ID,
		TenantID: tenantID,
		Role:     role,
	}); err != nil {
		return identity.User{}, err
	}
	return user, nil
}

// EnsureSuperAdmin creates or refreshes the platform identity. It has no
// tenant membership: platform routes are authorized by the user flag, not by
// a tenant role.
func (s AuthService) EnsureSuperAdmin(ctx context.Context, email, password, displayName string) (identity.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	displayName = strings.TrimSpace(displayName)
	if email == "" || !strings.Contains(email, "@") || len(password) < 8 || displayName == "" {
		return identity.User{}, identity.ErrInvalidUser
	}
	hash, err := s.passwords.Hash(password)
	if err != nil {
		return identity.User{}, err
	}
	return s.repo.UpsertUser(ctx, identity.User{
		ID:           uuid.New(),
		Email:        email,
		DisplayName:  displayName,
		PasswordHash: hash,
		Active:       true,
		IsSuperAdmin: true,
	})
}

func platformMembership() identity.Membership {
	return identity.Membership{TenantID: uuid.Nil, TenantName: "Plataforma", Role: identity.RoleSuperAdmin}
}

func (s AuthService) superAdminSession(user identity.User, token string) (Session, error) {
	if token == "" {
		issued, err := s.tokens.Issue(identity.Claims{
			UserID:    user.ID,
			TenantID:  uuid.Nil,
			Role:      identity.RoleSuperAdmin,
			ExpiresAt: time.Now().Add(s.tokenTTL).Unix(),
		})
		if err != nil {
			return Session{}, err
		}
		token = issued
	}
	return Session{User: user, Tenant: platformMembership(), Sites: []sites.Site{}, AccessToken: token}, nil
}
