package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/domain/identity"
)

var (
	ErrTokenInvalid = errors.New("invalid authentication token")
	ErrTokenExpired = errors.New("authentication token expired")
)

// TokenManager signs and validates the local JWT used by this iteration.
// The secret is mandatory in production; NewAPI fails fast there when missing.
type TokenManager struct {
	Secret []byte
	TTL    time.Duration
	Issuer string
}

const PurposeRefresh = "refresh"

func (m TokenManager) Issue(claims identity.Claims) (string, error) {
	now := time.Now()
	expires := claims.ExpiresAt
	if expires == 0 {
		ttl := m.TTL
		if ttl <= 0 {
			ttl = 8 * time.Hour
		}
		expires = now.Add(ttl).Unix()
	}
	issuer := m.Issuer
	if issuer == "" {
		issuer = "tourism-api"
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":       claims.UserID.String(),
		"tenant_id": claims.TenantID.String(),
		"role":      string(claims.Role),
		"iss":       issuer,
		"iat":       now.Unix(),
		"exp":       expires,
		"purpose":   claims.Purpose,
	})
	return token.SignedString(m.Secret)
}

func (m TokenManager) Parse(value string) (identity.Claims, error) {
	var claims jwt.MapClaims
	parsed, err := jwt.ParseWithClaims(value, &claims, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, ErrTokenInvalid
		}
		return m.Secret, nil
	}, jwt.WithExpirationRequired())
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return identity.Claims{}, ErrTokenExpired
		}
		return identity.Claims{}, ErrTokenInvalid
	}
	if !parsed.Valid {
		return identity.Claims{}, ErrTokenInvalid
	}
	userID, err := uuid.Parse(claimString(claims, "sub"))
	if err != nil {
		return identity.Claims{}, ErrTokenInvalid
	}
	tenantID, err := uuid.Parse(claimString(claims, "tenant_id"))
	if err != nil {
		return identity.Claims{}, ErrTokenInvalid
	}
	role := identity.NormalizeRole(claimString(claims, "role"))
	if !role.Valid() {
		return identity.Claims{}, ErrTokenInvalid
	}
	exp, err := claims.GetExpirationTime()
	if err != nil || exp == nil {
		return identity.Claims{}, ErrTokenInvalid
	}
	return identity.Claims{UserID: userID, TenantID: tenantID, Role: role, ExpiresAt: exp.Unix(), Purpose: claimString(claims, "purpose")}, nil
}

func (m TokenManager) IssueRefresh(claims identity.Claims, ttl time.Duration) (string, error) {
	if ttl <= 0 {
		ttl = 30 * 24 * time.Hour
	}
	claims.Purpose = PurposeRefresh
	claims.ExpiresAt = time.Now().Add(ttl).Unix()
	return m.Issue(claims)
}

func claimString(claims jwt.MapClaims, key string) string {
	value, ok := claims[key].(string)
	if !ok {
		return ""
	}
	return value
}
