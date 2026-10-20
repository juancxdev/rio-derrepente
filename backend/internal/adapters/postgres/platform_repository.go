package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/juancx/tourism-platform/backend/internal/domain/identity"
	"github.com/juancx/tourism-platform/backend/internal/domain/tenants"
)

// ListTenantSummaries returns every operator with its destination and account
// counts. It is only used by the platform administration surface.
func (r *Repositories) ListTenantSummaries(ctx context.Context) ([]tenants.Summary, error) {
	rows, err := r.Pool.Query(ctx, `SELECT t.id,t.name,
       (SELECT count(*) FROM tourist_sites s WHERE s.tenant_id=t.id),
       (SELECT count(*) FROM tenant_memberships m WHERE m.tenant_id=t.id)
FROM tenants t ORDER BY t.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []tenants.Summary{}
	for rows.Next() {
		var item tenants.Summary
		if err := rows.Scan(&item.ID, &item.Name, &item.Sites, &item.Accounts); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (r *Repositories) FindTenant(ctx context.Context, id uuid.UUID) (tenants.Tenant, error) {
	var tenant tenants.Tenant
	err := r.Pool.QueryRow(ctx, `SELECT id,name FROM tenants WHERE id=$1`, id).Scan(&tenant.ID, &tenant.Name)
	if errors.Is(err, pgx.ErrNoRows) {
		return tenants.Tenant{}, ErrScopeNotFound
	}
	return tenant, err
}

// ListAccounts returns every user with its optional tenant membership. Super
// administrators appear without a tenant.
func (r *Repositories) ListAccounts(ctx context.Context) ([]identity.Account, error) {
	rows, err := r.Pool.Query(ctx, `SELECT u.id,u.email,u.display_name,u.active,u.is_super_admin,
       m.tenant_id,t.name,m.role
FROM users u
LEFT JOIN tenant_memberships m ON m.user_id=u.id
LEFT JOIN tenants t ON t.id=m.tenant_id
ORDER BY u.email, t.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []identity.Account{}
	for rows.Next() {
		var account identity.Account
		var tenantID uuid.NullUUID
		var tenantName, role sql.NullString
		if err := rows.Scan(&account.UserID, &account.Email, &account.DisplayName, &account.Active, &account.IsSuperAdmin, &tenantID, &tenantName, &role); err != nil {
			return nil, err
		}
		if tenantID.Valid {
			value := tenantID.UUID
			account.TenantID = &value
		}
		account.TenantName = tenantName.String
		if role.Valid {
			account.Role = identity.NormalizeTenantRole(role.String)
		}
		result = append(result, account)
	}
	return result, rows.Err()
}

// CreateAccount upserts a user and its tenant membership atomically. An
// existing super administrator is never rewritten by this path: the service
// rejects that case before calling here.
func (r *Repositories) CreateAccount(ctx context.Context, user identity.User, membership identity.Membership) (identity.User, error) {
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return identity.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	err = tx.QueryRow(ctx, `INSERT INTO users(id,email,password_hash,display_name,active,is_super_admin)
VALUES($1,lower($2),$3,$4,true,false)
ON CONFLICT (lower(email)) DO UPDATE
SET password_hash=EXCLUDED.password_hash, display_name=EXCLUDED.display_name, active=true
RETURNING id,email,password_hash,display_name,active,is_super_admin`,
		user.ID, user.Email, user.PasswordHash, user.DisplayName).
		Scan(&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.Active, &user.IsSuperAdmin)
	if err != nil {
		return identity.User{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO tenant_memberships(user_id,tenant_id,role)
VALUES($1,$2,$3)
ON CONFLICT (user_id,tenant_id) DO UPDATE SET role=EXCLUDED.role`,
		user.ID, membership.TenantID, string(membership.Role)); err != nil {
		return identity.User{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return identity.User{}, err
	}
	return user, nil
}
