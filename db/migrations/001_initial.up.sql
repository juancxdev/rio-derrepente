CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tourist_sites (
  id UUID PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  timezone VARCHAR(60) NOT NULL DEFAULT 'America/Lima',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tourist_sites (id, code, name, latitude, longitude)
VALUES ('11111111-1111-1111-1111-111111111111', 'catarata-derrepente', 'Catarata del Río Derrepente', -9.295000, -75.996000)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS visit_records (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES tourist_sites(id),
  visit_date DATE NOT NULL,
  local_visitors INTEGER NOT NULL DEFAULT 0 CHECK (local_visitors >= 0),
  national_visitors INTEGER NOT NULL DEFAULT 0 CHECK (national_visitors >= 0),
  foreign_visitors INTEGER NOT NULL DEFAULT 0 CHECK (foreign_visitors >= 0),
  total_visitors INTEGER NOT NULL CHECK (total_visitors >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(site_id, visit_date)
);

CREATE TABLE IF NOT EXISTS weather_forecasts (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES tourist_sites(id),
  forecast_date DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  temperature_max NUMERIC(6,2),
  precipitation_mm NUMERIC(8,2),
  precipitation_probability NUMERIC(6,2),
  weather_code INTEGER,
  source VARCHAR(80) NOT NULL,
  raw_payload JSONB,
  UNIQUE(site_id, forecast_date, source, generated_at)
);

CREATE TABLE IF NOT EXISTS predictions (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES tourist_sites(id),
  prediction_date DATE NOT NULL,
  estimated_visitors NUMERIC(10,2) NOT NULL CHECK (estimated_visitors >= 0),
  score NUMERIC(6,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  level VARCHAR(20) NOT NULL,
  model_version VARCHAR(80) NOT NULL,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(site_id, prediction_date, model_version)
);

CREATE TABLE IF NOT EXISTS processing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_record_id BIGINT REFERENCES visit_records(id),
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_visits_site_date ON visit_records(site_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_predictions_site_date ON predictions(site_id, prediction_date);
