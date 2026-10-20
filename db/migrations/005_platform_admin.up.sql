-- Additive migration: platform-level super administrator.
-- The flag lives on the user, not on a tenant membership, because the super
-- administrator must be able to create operators before any tenant exists.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_super_admin ON users(is_super_admin) WHERE is_super_admin;
