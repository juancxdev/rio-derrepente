-- Additive migration: the legacy site remains readable and is attached to the
-- default tenant without changing any historical visit rows.
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(150) NOT NULL CHECK (length(trim(name)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tenants (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Operación inicial')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE tourist_sites ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE tourist_sites SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE tourist_sites ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sites_tenant ON tourist_sites(tenant_id);
-- A code identifies a destination within an operator, not across the whole SaaS.
ALTER TABLE tourist_sites DROP CONSTRAINT IF EXISTS tourist_sites_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tourist_sites_tenant_code ON tourist_sites(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tourist_sites_tenant_id ON tourist_sites(tenant_id, id);

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  site_id UUID NOT NULL REFERENCES tourist_sites(id),
  issued_for DATE NOT NULL,
  emission_code VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (length(trim(emission_code)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_tickets_scope_date ON tickets(tenant_id, site_id, issued_for);
ALTER TABLE tickets ADD CONSTRAINT fk_tickets_tenant_site
  FOREIGN KEY (tenant_id, site_id) REFERENCES tourist_sites(tenant_id, id);

CREATE TABLE IF NOT EXISTS historical_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  site_id UUID NOT NULL REFERENCES tourist_sites(id),
  source VARCHAR(80) NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_count INTEGER NOT NULL CHECK (row_count >= 0)
);
ALTER TABLE historical_imports ADD CONSTRAINT fk_imports_tenant_site
  FOREIGN KEY (tenant_id, site_id) REFERENCES tourist_sites(tenant_id, id);

ALTER TABLE visit_records DROP CONSTRAINT IF EXISTS visit_records_source_check;
ALTER TABLE visit_records ADD CONSTRAINT visit_records_source_check
  CHECK (source IN ('manual', 'official_castur', 'synthetic_demo', 'ticket_sales', 'historical_import'));
ALTER TABLE visit_records ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE visit_records v SET tenant_id = s.tenant_id FROM tourist_sites s WHERE s.id = v.site_id AND v.tenant_id IS NULL;
ALTER TABLE visit_records ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE visit_records ADD COLUMN IF NOT EXISTS weather_observed JSONB;
CREATE INDEX IF NOT EXISTS idx_visits_scope_date ON visit_records(tenant_id, site_id, visit_date);
ALTER TABLE visit_records ADD CONSTRAINT fk_visits_tenant_site
  FOREIGN KEY (tenant_id, site_id) REFERENCES tourist_sites(tenant_id, id);

CREATE TABLE IF NOT EXISTS daily_closures (
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  site_id UUID NOT NULL REFERENCES tourist_sites(id),
  closure_date DATE NOT NULL,
  visit_record_id BIGINT NOT NULL REFERENCES visit_records(id),
  event_published_at TIMESTAMPTZ,
  event_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, site_id, closure_date)
);
ALTER TABLE daily_closures ADD CONSTRAINT fk_closures_tenant_site
  FOREIGN KEY (tenant_id, site_id) REFERENCES tourist_sites(tenant_id, id);
