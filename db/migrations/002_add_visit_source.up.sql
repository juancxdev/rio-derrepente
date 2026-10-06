ALTER TABLE visit_records ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'manual';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visit_records_source_check'
  ) THEN
    ALTER TABLE visit_records
      ADD CONSTRAINT visit_records_source_check
      CHECK (source IN ('manual', 'official_castur', 'synthetic_demo'));
  END IF;
END $$;
