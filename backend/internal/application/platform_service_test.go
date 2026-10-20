package application

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/domain/identity"
	"github.com/juancx/tourism-platform/backend/internal/domain/sites"
	"github.com/juancx/tourism-platform/backend/internal/domain/tenants"
)

type platformRepoStub struct {
	tenants  []tenants.Summary
	sites    map[uuid.UUID][]sites.Site
	accounts []identity.Account
	users    map[string]identity.User
}

func newPlatformRepoStub() *platformRepoStub {
	return &platformRepoStub{
		tenants: []tenants.Summary{{Tenant: tenants.Tenant{ID: uuid.New(), Name: "Operador"}}},
		sites:   map[uuid.UUID][]sites.Site{},
		users:   map[string]identity.User{},
	}
}

func (s *platformRepoStub) ListTenantSummaries(context.Context) ([]tenants.Summary, error) {
	return s.tenants, nil
}

func (s *platformRepoStub) FindTenant(_ context.Context, id uuid.UUID) (tenants.Tenant, error) {
	for _, item := range s.tenants {
		if item.ID == id {
			return item.Tenant, nil
		}
	}
	return tenants.Tenant{}, errors.New("tenant not found")
}

func (s *platformRepoStub) CreateTenant(_ context.Context, tenant tenants.Tenant) (tenants.Tenant, error) {
	s.tenants = append(s.tenants, tenants.Summary{Tenant: tenant})
	return tenant, nil
}

func (s *platformRepoStub) ListSites(_ context.Context, tenantID uuid.UUID) ([]sites.Site, error) {
	return s.sites[tenantID], nil
}

func (s *platformRepoStub) CreateSite(_ context.Context, site sites.Site) (sites.Site, error) {
	s.sites[site.TenantID] = append(s.sites[site.TenantID], site)
	return site, nil
}

func (s *platformRepoStub) ListAccounts(context.Context) ([]identity.Account, error) {
	return s.accounts, nil
}

func (s *platformRepoStub) FindUserByEmail(_ context.Context, email string) (identity.User, error) {
	if user, ok := s.users[email]; ok {
		return user, nil
	}
	return identity.User{}, identity.ErrUserNotFound
}

func (s *platformRepoStub) CreateAccount(_ context.Context, user identity.User, membership identity.Membership) (identity.User, error) {
	s.users[user.Email] = user
	s.accounts = append(s.accounts, identity.Account{
		UserID: user.ID, Email: user.Email, DisplayName: user.DisplayName, Active: user.Active,
		TenantID: &membership.TenantID, TenantName: "Operador", Role: membership.Role,
	})
	return user, nil
}

func TestPlatformCreatesAnAccountForOneTenant(t *testing.T) {
	repo := newPlatformRepoStub()
	service := NewPlatformService(repo, passwordStub{})
	account, err := service.CreateAccount(context.Background(), "Admin@Example.com", "Admin", "clave-segura", repo.tenants[0].ID, identity.RoleAdmin)
	if err != nil {
		t.Fatal(err)
	}
	if account.Email != "admin@example.com" || account.TenantID == nil || *account.TenantID != repo.tenants[0].ID || account.Role != identity.RoleAdmin {
		t.Fatalf("unexpected account: %+v", account)
	}
	if repo.users["admin@example.com"].PasswordHash != "hash:clave-segura" {
		t.Fatalf("password was not hashed: %+v", repo.users["admin@example.com"])
	}
}

func TestPlatformRejectsTheSuperAdminRoleInATenantAccount(t *testing.T) {
	repo := newPlatformRepoStub()
	service := NewPlatformService(repo, passwordStub{})
	_, err := service.CreateAccount(context.Background(), "admin@example.com", "Admin", "clave-segura", repo.tenants[0].ID, identity.RoleSuperAdmin)
	if !errors.Is(err, identity.ErrInvalidUser) {
		t.Fatalf("want invalid user, got %v", err)
	}
}

func TestPlatformCannotRewriteASuperAdminFromATenantAccount(t *testing.T) {
	repo := newPlatformRepoStub()
	repo.users["super@example.com"] = identity.User{ID: uuid.New(), Email: "super@example.com", IsSuperAdmin: true, Active: true}
	service := NewPlatformService(repo, passwordStub{})
	_, err := service.CreateAccount(context.Background(), "super@example.com", "Super", "clave-segura", repo.tenants[0].ID, identity.RoleAdmin)
	if !errors.Is(err, identity.ErrForbidden) {
		t.Fatalf("want forbidden, got %v", err)
	}
}

func TestPlatformCreatesATrimmedTenant(t *testing.T) {
	repo := newPlatformRepoStub()
	service := NewPlatformService(repo, passwordStub{})
	tenant, err := service.CreateTenant(context.Background(), "  Nuevo operador  ")
	if err != nil {
		t.Fatal(err)
	}
	if tenant.Name != "Nuevo operador" {
		t.Fatalf("unexpected tenant name: %q", tenant.Name)
	}
}

func TestPlatformCreatesASiteForTheSelectedTenant(t *testing.T) {
	repo := newPlatformRepoStub()
	service := NewPlatformService(repo, passwordStub{})
	site, err := service.CreateSite(context.Background(), repo.tenants[0].ID, "catarata", "Catarata", -9.295, -75.996, "America/Lima")
	if err != nil {
		t.Fatal(err)
	}
	if site.TenantID != repo.tenants[0].ID || len(repo.sites[repo.tenants[0].ID]) != 1 {
		t.Fatalf("unexpected site: %+v", site)
	}
}
