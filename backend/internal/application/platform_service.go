package application

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/domain/identity"
	"github.com/juancx/tourism-platform/backend/internal/domain/sites"
	"github.com/juancx/tourism-platform/backend/internal/domain/tenants"
)

// PlatformRepository is the persistence port for the super-administrator
// console. It deliberately does not expose ticket or visit operations.
type PlatformRepository interface {
	ListTenantSummaries(context.Context) ([]tenants.Summary, error)
	FindTenant(context.Context, uuid.UUID) (tenants.Tenant, error)
	CreateTenant(context.Context, tenants.Tenant) (tenants.Tenant, error)
	ListSites(context.Context, uuid.UUID) ([]sites.Site, error)
	CreateSite(context.Context, sites.Site) (sites.Site, error)
	ListAccounts(context.Context) ([]identity.Account, error)
	FindUserByEmail(context.Context, string) (identity.User, error)
	CreateAccount(context.Context, identity.User, identity.Membership) (identity.User, error)
}

type PlatformService struct {
	repo      PlatformRepository
	passwords PasswordService
}

func NewPlatformService(repo PlatformRepository, passwords PasswordService) PlatformService {
	return PlatformService{repo: repo, passwords: passwords}
}

func (s PlatformService) ListTenants(ctx context.Context) ([]tenants.Summary, error) {
	return s.repo.ListTenantSummaries(ctx)
}

func (s PlatformService) CreateTenant(ctx context.Context, name string) (tenants.Tenant, error) {
	tenant, err := tenants.New(name)
	if err != nil {
		return tenant, err
	}
	return s.repo.CreateTenant(ctx, tenant)
}

func (s PlatformService) ListSites(ctx context.Context, tenantID uuid.UUID) ([]sites.Site, error) {
	if _, err := s.repo.FindTenant(ctx, tenantID); err != nil {
		return nil, err
	}
	return s.repo.ListSites(ctx, tenantID)
}

func (s PlatformService) CreateSite(ctx context.Context, tenantID uuid.UUID, code, name string, latitude, longitude float64, timezone string) (sites.Site, error) {
	if _, err := s.repo.FindTenant(ctx, tenantID); err != nil {
		return sites.Site{}, err
	}
	site, err := sites.New(tenantID, code, name, latitude, longitude, timezone)
	if err != nil {
		return site, err
	}
	if _, err = time.LoadLocation(timezone); err != nil {
		return sites.Site{}, sites.ErrInvalidSite
	}
	return s.repo.CreateSite(ctx, site)
}

func (s PlatformService) ListAccounts(ctx context.Context) ([]identity.Account, error) {
	return s.repo.ListAccounts(ctx)
}

// CreateAccount creates or refreshes a tenant account. A super administrator
// cannot be turned into a tenant account by reusing its email.
func (s PlatformService) CreateAccount(ctx context.Context, email, displayName, password string, tenantID uuid.UUID, role identity.Role) (identity.Account, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	displayName = strings.TrimSpace(displayName)
	if email == "" || !strings.Contains(email, "@") || len(password) < 8 || displayName == "" || !role.ValidTenantRole() {
		return identity.Account{}, identity.ErrInvalidUser
	}
	tenant, err := s.repo.FindTenant(ctx, tenantID)
	if err != nil {
		return identity.Account{}, err
	}
	existing, err := s.repo.FindUserByEmail(ctx, email)
	if err != nil && !errors.Is(err, identity.ErrUserNotFound) {
		return identity.Account{}, err
	}
	if existing.IsSuperAdmin {
		return identity.Account{}, identity.ErrForbidden
	}
	hash, err := s.passwords.Hash(password)
	if err != nil {
		return identity.Account{}, err
	}
	newUser := identity.User{
		ID:           uuid.New(),
		Email:        email,
		DisplayName:  displayName,
		PasswordHash: hash,
		Active:       true,
	}
	user, err := s.repo.CreateAccount(ctx, newUser, identity.Membership{UserID: newUser.ID, TenantID: tenantID, Role: role})
	if err != nil {
		return identity.Account{}, err
	}
	return identity.Account{
		UserID:      user.ID,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		Active:      user.Active,
		TenantID:    &tenant.ID,
		TenantName:  tenant.Name,
		Role:        role,
	}, nil
}
