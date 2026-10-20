package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/domain/identity"
	"github.com/juancx/tourism-platform/backend/internal/domain/sites"
)

type identityRepoStub struct {
	users       map[string]identity.User
	memberships map[uuid.UUID][]identity.Membership
}

func newIdentityRepoStub() *identityRepoStub {
	return &identityRepoStub{users: map[string]identity.User{}, memberships: map[uuid.UUID][]identity.Membership{}}
}
func (s *identityRepoStub) FindUserByEmail(_ context.Context, email string) (identity.User, error) {
	if u, ok := s.users[email]; ok {
		return u, nil
	}
	return identity.User{}, identity.ErrUserNotFound
}
func (s *identityRepoStub) FindUserByID(_ context.Context, id uuid.UUID) (identity.User, error) {
	for _, u := range s.users {
		if u.ID == id {
			return u, nil
		}
	}
	return identity.User{}, identity.ErrUserNotFound
}
func (s *identityRepoStub) Memberships(_ context.Context, userID uuid.UUID) ([]identity.Membership, error) {
	return s.memberships[userID], nil
}
func (s *identityRepoStub) Membership(_ context.Context, userID, tenantID uuid.UUID) (identity.Membership, error) {
	for _, m := range s.memberships[userID] {
		if m.TenantID == tenantID {
			return m, nil
		}
	}
	return identity.Membership{}, identity.ErrMembershipNotFound
}
func (s *identityRepoStub) UpsertUser(_ context.Context, u identity.User) (identity.User, error) {
	s.users[u.Email] = u
	return u, nil
}
func (s *identityRepoStub) UpsertMembership(_ context.Context, m identity.Membership) error {
	s.memberships[m.UserID] = append(s.memberships[m.UserID], m)
	return nil
}

type passwordStub struct{ valid bool }

func (p passwordStub) Hash(plain string) (string, error) { return "hash:" + plain, nil }
func (p passwordStub) Verify(hash, plain string) bool    { return p.valid && hash == "hash:"+plain }

type tokenStub struct{ claims identity.Claims }

func (t *tokenStub) Issue(c identity.Claims) (string, error) {
	t.claims = c
	return "signed-token", nil
}
func (t *tokenStub) Parse(string) (identity.Claims, error) { return t.claims, nil }

type siteListerStub struct{ sites []sites.Site }

func (s siteListerStub) ListSites(context.Context, uuid.UUID) ([]sites.Site, error) {
	return s.sites, nil
}

func authFixture(active bool, membership bool) (*identityRepoStub, applicationAuth) {
	userID, tenantID := uuid.New(), uuid.New()
	repo := newIdentityRepoStub()
	user := identity.User{ID: userID, Email: "operador@example.com", DisplayName: "Operador", PasswordHash: "hash:clave-segura", Active: active}
	repo.users[user.Email] = user
	if membership {
		repo.memberships[userID] = []identity.Membership{{UserID: userID, TenantID: tenantID, TenantName: "Operador turístico", Role: identity.RoleManager}}
	}
	tokens := &tokenStub{}
	service := NewAuthService(repo, siteListerStub{sites: []sites.Site{{ID: uuid.New(), TenantID: tenantID}}}, passwordStub{valid: true}, tokens, time.Hour)
	return repo, applicationAuth{service: service, tokens: tokens, user: user, tenantID: tenantID}
}

type applicationAuth struct {
	service  AuthService
	tokens   *tokenStub
	user     identity.User
	tenantID uuid.UUID
}

func TestLoginReturnsASignedTenantScopedSession(t *testing.T) {
	_, fixture := authFixture(true, true)
	session, err := fixture.service.Login(context.Background(), "  OPERADOR@example.com ", "clave-segura")
	if err != nil {
		t.Fatal(err)
	}
	if session.AccessToken != "signed-token" || session.User.ID != fixture.user.ID {
		t.Fatalf("unexpected session: %+v", session)
	}
	if fixture.tokens.claims.TenantID != fixture.tenantID || fixture.tokens.claims.Role != identity.RoleManager {
		t.Fatalf("token must carry tenant and role: %+v", fixture.tokens.claims)
	}
	if len(session.Sites) != 1 {
		t.Fatalf("want hydrated sites, got %d", len(session.Sites))
	}
}

func TestLoginRejectsAWrongPassword(t *testing.T) {
	repo, _ := authFixture(true, true)
	tokens := &tokenStub{}
	service := NewAuthService(repo, nil, passwordStub{valid: false}, tokens, time.Hour)
	if _, err := service.Login(context.Background(), "operador@example.com", "incorrecta"); !errors.Is(err, identity.ErrInvalidCredentials) {
		t.Fatalf("want invalid credentials, got %v", err)
	}
	if tokens.claims.UserID != uuid.Nil {
		t.Fatal("a failed login must not issue a token")
	}
}

func TestLoginRejectsAnInactiveUser(t *testing.T) {
	_, fixture := authFixture(false, true)
	if _, err := fixture.service.Login(context.Background(), "operador@example.com", "clave-segura"); !errors.Is(err, identity.ErrInactiveUser) {
		t.Fatalf("want inactive user, got %v", err)
	}
}

func TestLoginRejectsAUserWithoutTenantMembership(t *testing.T) {
	_, fixture := authFixture(true, false)
	if _, err := fixture.service.Login(context.Background(), "operador@example.com", "clave-segura"); !errors.Is(err, identity.ErrMembershipNotFound) {
		t.Fatalf("want missing membership, got %v", err)
	}
}

func TestAuthenticateRejectsATenantOutsideTheMembership(t *testing.T) {
	_, fixture := authFixture(true, true)
	if _, _, err := fixture.service.Authenticate(context.Background(), fixture.user.ID, uuid.New()); !errors.Is(err, identity.ErrMembershipNotFound) {
		t.Fatalf("want tenant rejection, got %v", err)
	}
}

func TestSuperAdminLoginUsesAPlatformSessionWithoutATenant(t *testing.T) {
	repo := newIdentityRepoStub()
	tokens := &tokenStub{}
	service := NewAuthService(repo, nil, passwordStub{valid: true}, tokens, time.Hour)
	user, err := service.EnsureSuperAdmin(context.Background(), "Super@Example.com", "clave-segura", "Super administrador")
	if err != nil {
		t.Fatal(err)
	}
	if !user.IsSuperAdmin || user.Email != "super@example.com" {
		t.Fatalf("unexpected seeded super admin: %+v", user)
	}
	session, err := service.Login(context.Background(), "super@example.com", "clave-segura")
	if err != nil {
		t.Fatal(err)
	}
	if session.Tenant.Role != identity.RoleSuperAdmin || session.Tenant.TenantID != uuid.Nil {
		t.Fatalf("want platform role and nil tenant, got %+v", session.Tenant)
	}
	if session.User.ID != user.ID || session.AccessToken != "signed-token" || len(session.Sites) != 0 {
		t.Fatalf("unexpected super admin session: %+v", session)
	}
	if tokens.claims.Role != identity.RoleSuperAdmin || tokens.claims.TenantID != uuid.Nil {
		t.Fatalf("unexpected super admin claims: %+v", tokens.claims)
	}
}

func TestSuperAdminAuthenticatesWithoutATenantMembership(t *testing.T) {
	repo := newIdentityRepoStub()
	service := NewAuthService(repo, nil, passwordStub{}, &tokenStub{}, time.Hour)
	user, err := service.EnsureSuperAdmin(context.Background(), "super@example.com", "clave-segura", "Super")
	if err != nil {
		t.Fatal(err)
	}
	authenticated, membership, err := service.Authenticate(context.Background(), user.ID, uuid.New())
	if err != nil {
		t.Fatal(err)
	}
	if authenticated.ID != user.ID || membership.Role != identity.RoleSuperAdmin || membership.TenantID != uuid.Nil {
		t.Fatalf("unexpected authentication for super admin: %+v %+v", authenticated, membership)
	}
}

func TestEnsureSuperAdminRejectsAShortPassword(t *testing.T) {
	service := NewAuthService(newIdentityRepoStub(), nil, passwordStub{}, &tokenStub{}, time.Hour)
	if _, err := service.EnsureSuperAdmin(context.Background(), "super@example.com", "corta", "Super"); !errors.Is(err, identity.ErrInvalidUser) {
		t.Fatalf("want invalid user, got %v", err)
	}
}

func TestEnsureDemoUserHashesThePassword(t *testing.T) {
	repo := newIdentityRepoStub()
	service := NewAuthService(repo, nil, passwordStub{}, &tokenStub{}, time.Hour)
	user, err := service.EnsureDemoUser(context.Background(), "Demo@Example.com", "clave-segura", "Demo", uuid.New(), identity.RoleManager)
	if err != nil {
		t.Fatal(err)
	}
	if user.Email != "demo@example.com" || user.PasswordHash != "hash:clave-segura" {
		t.Fatalf("unexpected seeded user: %+v", user)
	}
}
