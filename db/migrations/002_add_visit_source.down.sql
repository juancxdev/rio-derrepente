ALTER TABLE visit_records DROP CONSTRAINT IF EXISTS visit_records_source_check;
ALTER TABLE visit_records DROP COLUMN IF EXISTS source;
