-- Additive migration: identity for local, demonstrable authentication.
-- It never touches existing tenants, sites, tickets, visits or closures.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(180) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (length(trim(email)) > 3 AND position('@' in email) > 1),
  CHECK (length(trim(display_name)) > 0),
  CHECK (length(password_hash) > 0)
);

-- Email is the login handle, so it must be unique regardless of casing.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users(lower(email));

CREATE TABLE IF NOT EXISTS tenant_memberships (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id),
  CHECK (role IN ('operator', 'manager', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON tenant_memberships(tenant_id);

-- Idempotent ticket sales: a repeated request with the same key returns the
-- tickets created by the first one instead of emitting duplicates.
CREATE TABLE IF NOT EXISTS ticket_sale_requests (
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  site_id UUID NOT NULL REFERENCES tourist_sites(id),
  idempotency_key VARCHAR(120) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100),
  codes TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, site_id, idempotency_key),
  CHECK (length(trim(idempotency_key)) > 0),
  FOREIGN KEY (tenant_id, site_id) REFERENCES tourist_sites(tenant_id, id)
);
