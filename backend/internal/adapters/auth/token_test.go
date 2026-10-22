package auth

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/domain/identity"
)

func TestTokenRoundTripCarriesTenantAndRole(t *testing.T) {
	manager := TokenManager{Secret: []byte("test-secret")}
	userID, tenantID := uuid.New(), uuid.New()
	token, err := manager.Issue(identity.Claims{UserID: userID, TenantID: tenantID, Role: identity.RoleManager, ExpiresAt: time.Now().Add(time.Hour).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	claims, err := manager.Parse(token)
	if err != nil {
		t.Fatal(err)
	}
	if claims.UserID != userID || claims.TenantID != tenantID || claims.Role != identity.RoleManager {
		t.Fatalf("unexpected claims: %+v", claims)
	}
}

func TestExpiredTokenIsRejected(t *testing.T) {
	manager := TokenManager{Secret: []byte("test-secret")}
	token, err := manager.Issue(identity.Claims{UserID: uuid.New(), TenantID: uuid.New(), Role: identity.RoleOperator, ExpiresAt: time.Now().Add(-time.Minute).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Parse(token); !errors.Is(err, ErrTokenExpired) {
		t.Fatalf("want expired token, got %v", err)
	}
}

func TestTokenSignedWithAnotherSecretIsRejected(t *testing.T) {
	issuer := TokenManager{Secret: []byte("other-secret")}
	token, err := issuer.Issue(identity.Claims{UserID: uuid.New(), TenantID: uuid.New(), Role: identity.RoleAdmin, ExpiresAt: time.Now().Add(time.Hour).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	verifier := TokenManager{Secret: []byte("test-secret")}
	if _, err := verifier.Parse(token); !errors.Is(err, ErrTokenInvalid) {
		t.Fatalf("want invalid token, got %v", err)
	}
}

func TestRefreshTokenCarriesRefreshPurpose(t *testing.T) {
	manager := TokenManager{Secret: []byte("test-secret")}
	token, err := manager.IssueRefresh(identity.Claims{UserID: uuid.New(), TenantID: uuid.New(), Role: identity.RoleManager}, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := manager.Parse(token)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Purpose != PurposeRefresh {
		t.Fatalf("want refresh purpose, got %q", claims.Purpose)
	}
}
