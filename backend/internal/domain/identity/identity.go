package identity

import (
	"errors"
	"strings"

	"github.com/google/uuid"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrInactiveUser       = errors.New("the user account is inactive")
	ErrForbidden          = errors.New("the current role cannot perform this action")
	ErrUserNotFound       = errors.New("user not found")
	ErrMembershipNotFound = errors.New("tenant membership not found")
	ErrInvalidUser        = errors.New("email, display name and password are required")
)

// Role models the membership of a user inside one tenant. Roles are ordered:
// an admin can do everything a manager can, and a manager everything an
// operator can.
type Role string

const (
	RoleOperator   Role = "operator"
	RoleManager    Role = "manager"
	RoleAdmin      Role = "admin"
	RoleSuperAdmin Role = "super_admin"
)

func (r Role) Valid() bool {
	return r == RoleOperator || r == RoleManager || r == RoleAdmin || r == RoleSuperAdmin
}

// ValidTenantRole reports whether the role can be stored in a tenant
// membership. Super administrators are platform identities without a tenant.
func (r Role) ValidTenantRole() bool {
	return r == RoleOperator || r == RoleManager || r == RoleAdmin
}

func (r Role) rank() int {
	switch r {
	case RoleSuperAdmin:
		return 4
	case RoleAdmin:
		return 3
	case RoleManager:
		return 2
	case RoleOperator:
		return 1
	default:
		return 0
	}
}

// Allows reports whether the role satisfies the required minimum role.
func (r Role) Allows(required Role) bool {
	return r.Valid() && r.rank() >= required.rank()
}

func NormalizeRole(value string) Role {
	role := Role(strings.ToLower(strings.TrimSpace(value)))
	if role.Valid() {
		return role
	}
	return RoleOperator
}

// NormalizeTenantRole keeps platform-only roles out of tenant memberships.
func NormalizeTenantRole(value string) Role {
	role := Role(strings.ToLower(strings.TrimSpace(value)))
	if role.ValidTenantRole() {
		return role
	}
	return RoleOperator
}

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	DisplayName  string    `json:"display_name"`
	PasswordHash string    `json:"-"`
	Active       bool      `json:"active"`
	IsSuperAdmin bool      `json:"is_super_admin"`
}

// Account is the platform-level view of a user and its tenant membership.
type Account struct {
	UserID       uuid.UUID  `json:"user_id"`
	Email        string     `json:"email"`
	DisplayName  string     `json:"display_name"`
	Active       bool       `json:"active"`
	IsSuperAdmin bool       `json:"is_super_admin"`
	TenantID     *uuid.UUID `json:"tenant_id,omitempty"`
	TenantName   string     `json:"tenant_name,omitempty"`
	Role         Role       `json:"role,omitempty"`
}

// Membership is the tenant context of the authenticated session.
type Membership struct {
	UserID     uuid.UUID `json:"-"`
	TenantID   uuid.UUID `json:"id"`
	TenantName string    `json:"name"`
	Role       Role      `json:"role"`
}

type Claims struct {
	UserID    uuid.UUID
	TenantID  uuid.UUID
	Role      Role
	ExpiresAt int64
}
