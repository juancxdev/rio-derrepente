package httpadapter

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	authadapter "github.com/juancx/tourism-platform/backend/internal/adapters/auth"
	"github.com/juancx/tourism-platform/backend/internal/adapters/logging"
	"github.com/juancx/tourism-platform/backend/internal/application"
	"github.com/juancx/tourism-platform/backend/internal/domain/identity"
	"github.com/juancx/tourism-platform/backend/internal/domain/sites"
	"github.com/juancx/tourism-platform/backend/internal/domain/tenants"
)

type platformAdminRepoStub struct {
	tenant  tenants.Tenant
	sites   []sites.Site
	users   map[string]identity.User
	created []identity.Account
}

func newPlatformAdminRepoStub() *platformAdminRepoStub {
	return &platformAdminRepoStub{
		tenant: tenants.Tenant{ID: uuid.New(), Name: "Operador inicial"},
		users:  map[string]identity.User{},
	}
}

func (s *platformAdminRepoStub) ListTenantSummaries(context.Context) ([]tenants.Summary, error) {
	return []tenants.Summary{{Tenant: s.tenant, Sites: len(s.sites), Accounts: len(s.created)}}, nil
}

func (s *platformAdminRepoStub) FindTenant(_ context.Context, id uuid.UUID) (tenants.Tenant, error) {
	if id == s.tenant.ID {
		return s.tenant, nil
	}
	return tenants.Tenant{}, errors.New("tenant not found")
}

func (s *platformAdminRepoStub) CreateTenant(_ context.Context, tenant tenants.Tenant) (tenants.Tenant, error) {
	s.tenant = tenant
	return tenant, nil
}

func (s *platformAdminRepoStub) ListSites(context.Context, uuid.UUID) ([]sites.Site, error) {
	return s.sites, nil
}

func (s *platformAdminRepoStub) CreateSite(_ context.Context, site sites.Site) (sites.Site, error) {
	s.sites = append(s.sites, site)
	return site, nil
}

func (s *platformAdminRepoStub) ListAccounts(context.Context) ([]identity.Account, error) {
	return s.created, nil
}

func (s *platformAdminRepoStub) FindUserByEmail(_ context.Context, email string) (identity.User, error) {
	if user, ok := s.users[email]; ok {
		return user, nil
	}
	return identity.User{}, identity.ErrUserNotFound
}

func (s *platformAdminRepoStub) CreateAccount(_ context.Context, user identity.User, membership identity.Membership) (identity.User, error) {
	s.users[user.Email] = user
	s.created = append(s.created, identity.Account{
		UserID: user.ID, Email: user.Email, DisplayName: user.DisplayName, Active: user.Active,
		TenantID: &membership.TenantID, TenantName: s.tenant.Name, Role: membership.Role,
	})
	return user, nil
}

type platformHTTPFixture struct {
	app        *fiber.App
	tokens     authadapter.TokenManager
	superToken string
	tenantID   uuid.UUID
	repo       *platformAdminRepoStub
}

func newPlatformHTTPFixture(t *testing.T) *platformHTTPFixture {
	t.Helper()
	superID := uuid.New()
	repo := identityStub{
		user: identity.User{ID: superID, Email: "super@example.com", DisplayName: "Super", PasswordHash: "hash:clave-segura", Active: true, IsSuperAdmin: true},
	}
	tokens := authadapter.TokenManager{Secret: []byte("test-secret"), TTL: time.Hour}
	platformRepo := newPlatformAdminRepoStub()
	authService := application.NewAuthService(repo, nil, passwordStub{}, tokens, time.Hour)
	platform := application.NewPlatformService(platformRepo, passwordStub{})
	app := New(application.NewRegisterVisitService(memoryVisits{}, noopPublisher{}), application.NewGetPredictionService(missingPredictions{}), fixedWeather{}, -9.295, -75.996, logging.New()).
		WithPlatform(platform).
		WithAuth(authService, tokens).
		App()
	token, err := tokens.Issue(identity.Claims{UserID: superID, TenantID: uuid.Nil, Role: identity.RoleSuperAdmin, ExpiresAt: time.Now().Add(time.Hour).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	return &platformHTTPFixture{app: app, tokens: tokens, superToken: token, tenantID: platformRepo.tenant.ID, repo: platformRepo}
}

func (f *platformHTTPFixture) do(method, path, body, token string) *http.Response {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := f.app.Test(req, -1)
	if err != nil {
		panic(err)
	}
	return res
}

func TestPlatformRoutesRejectMissingTokensAndTenantUsers(t *testing.T) {
	f := newPlatformHTTPFixture(t)
	if res := f.do(http.MethodGet, "/api/v1/admin/tenants", "", ""); res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("want 401 without token, got %d: %s", res.StatusCode, decodeBody(t, res))
	}
	tenantFixture := newAuthFixture(true, identity.RoleManager, true)
	if res := tenantFixture.do(http.MethodGet, "/api/v1/admin/tenants", "", tenantFixture.token(t)); res.StatusCode != http.StatusForbidden {
		t.Fatalf("want 403 for tenant user, got %d: %s", res.StatusCode, decodeBody(t, res))
	}
	if res := f.do(http.MethodGet, "/api/v1/admin/tenants", "", f.superToken); res.StatusCode != http.StatusOK {
		t.Fatalf("want 200 for super admin, got %d: %s", res.StatusCode, decodeBody(t, res))
	}
}

func TestSuperAdminCreatesATenantAndAnAccount(t *testing.T) {
	f := newPlatformHTTPFixture(t)
	res := f.do(http.MethodPost, "/api/v1/admin/tenants", `{"name":"Nuevo operador"}`, f.superToken)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("want 201 creating tenant, got %d: %s", res.StatusCode, decodeBody(t, res))
	}
	body := decodeBody(t, res)
	if !strings.Contains(body, "Nuevo operador") {
		t.Fatalf("unexpected tenant body: %s", body)
	}

	res = f.do(http.MethodPost, "/api/v1/admin/users", `{"email":"admin@example.com","display_name":"Admin","password":"clave-segura","tenant_id":"`+f.repo.tenant.ID.String()+`","role":"admin"}`, f.superToken)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("want 201 creating account, got %d: %s", res.StatusCode, decodeBody(t, res))
	}
	accountBody := decodeBody(t, res)
	if strings.Contains(accountBody, "password") || !strings.Contains(accountBody, "admin@example.com") {
		t.Fatalf("unexpected account body: %s", accountBody)
	}
}

func TestPlatformRejectsAnInvalidTenantRole(t *testing.T) {
	f := newPlatformHTTPFixture(t)
	res := f.do(http.MethodPost, "/api/v1/admin/users", `{"email":"admin@example.com","display_name":"Admin","password":"clave-segura","tenant_id":"`+f.tenantID.String()+`","role":"super_admin"}`, f.superToken)
	if res.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("want 422 for super_admin role, got %d: %s", res.StatusCode, decodeBody(t, res))
	}
}
