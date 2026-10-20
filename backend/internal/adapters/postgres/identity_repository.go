package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/juancx/tourism-platform/backend/internal/domain/identity"
)

func (r *Repositories) FindUserByEmail(ctx context.Context, email string) (identity.User, error) {
	var user identity.User
	err := r.Pool.QueryRow(ctx, `SELECT id,email,password_hash,display_name,active,is_super_admin FROM users WHERE lower(email)=lower($1)`, email).
		Scan(&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.Active, &user.IsSuperAdmin)
	if errors.Is(err, pgx.ErrNoRows) {
		return identity.User{}, identity.ErrUserNotFound
	}
	return user, err
}

func (r *Repositories) FindUserByID(ctx context.Context, id uuid.UUID) (identity.User, error) {
	var user identity.User
	err := r.Pool.QueryRow(ctx, `SELECT id,email,password_hash,display_name,active,is_super_admin FROM users WHERE id=$1`, id).
		Scan(&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.Active, &user.IsSuperAdmin)
	if errors.Is(err, pgx.ErrNoRows) {
		return identity.User{}, identity.ErrUserNotFound
	}
	return user, err
}

func (r *Repositories) Memberships(ctx context.Context, userID uuid.UUID) ([]identity.Membership, error) {
	rows, err := r.Pool.Query(ctx, `SELECT m.user_id,m.tenant_id,t.name,m.role
FROM tenant_memberships m JOIN tenants t ON t.id=m.tenant_id
WHERE m.user_id=$1 ORDER BY m.created_at, t.name`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []identity.Membership{}
	for rows.Next() {
		var m identity.Membership
		var role string
		if err := rows.Scan(&m.UserID, &m.TenantID, &m.TenantName, &role); err != nil {
			return nil, err
		}
		m.Role = identity.NormalizeRole(role)
		result = append(result, m)
	}
	return result, rows.Err()
}

func (r *Repositories) Membership(ctx context.Context, userID, tenantID uuid.UUID) (identity.Membership, error) {
	var m identity.Membership
	var role string
	err := r.Pool.QueryRow(ctx, `SELECT m.user_id,m.tenant_id,t.name,m.role
FROM tenant_memberships m JOIN tenants t ON t.id=m.tenant_id
WHERE m.user_id=$1 AND m.tenant_id=$2`, userID, tenantID).
		Scan(&m.UserID, &m.TenantID, &m.TenantName, &role)
	if errors.Is(err, pgx.ErrNoRows) {
		return identity.Membership{}, identity.ErrMembershipNotFound
	}
	if err != nil {
		return identity.Membership{}, err
	}
	m.Role = identity.NormalizeRole(role)
	return m, nil
}

func (r *Repositories) UpsertUser(ctx context.Context, user identity.User) (identity.User, error) {
	err := r.Pool.QueryRow(ctx, `INSERT INTO users(id,email,password_hash,display_name,active,is_super_admin)
VALUES($1,lower($2),$3,$4,$5,$6)
ON CONFLICT (lower(email)) DO UPDATE
SET password_hash=EXCLUDED.password_hash, display_name=EXCLUDED.display_name, active=EXCLUDED.active, is_super_admin=EXCLUDED.is_super_admin
RETURNING id,email,password_hash,display_name,active,is_super_admin`,
		user.ID, user.Email, user.PasswordHash, user.DisplayName, user.Active, user.IsSuperAdmin).
		Scan(&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.Active, &user.IsSuperAdmin)
	return user, err
}

func (r *Repositories) UpsertMembership(ctx context.Context, membership identity.Membership) error {
	_, err := r.Pool.Exec(ctx, `INSERT INTO tenant_memberships(user_id,tenant_id,role)
VALUES($1,$2,$3)
ON CONFLICT (user_id,tenant_id) DO UPDATE SET role=EXCLUDED.role`,
		membership.UserID, membership.TenantID, string(membership.Role))
	return err
}
