-- DEMOSTRACIÓN: no son conteos reales de CASTUR. Se generaron usando la lluvia
-- histórica de Open-Meteo para probar el flujo de predicción y el dashboard.
INSERT INTO visit_records(site_id, visit_date, local_visitors, national_visitors, foreign_visitors, total_visitors, source, notes)
VALUES
('11111111-1111-1111-1111-111111111111','2026-10-01',2,5,0,7,'synthetic_demo','synthetic_demo: lluvia histórica 23.2 mm'),
('11111111-1111-1111-1111-111111111111','2026-10-02',4,10,0,14,'synthetic_demo','synthetic_demo: lluvia histórica 6.9 mm'),
('11111111-1111-1111-1111-111111111111','2026-10-03',6,15,1,22,'synthetic_demo','synthetic_demo: lluvia histórica 2.6 mm'),
('11111111-1111-1111-1111-111111111111','2026-10-04',10,25,1,36,'synthetic_demo','synthetic_demo: lluvia histórica 0.1 mm'),
('11111111-1111-1111-1111-111111111111','2026-10-05',11,28,1,40,'synthetic_demo','synthetic_demo: lluvia histórica 0.6 mm'),
('11111111-1111-1111-1111-111111111111','2026-10-06',12,30,1,43,'synthetic_demo','synthetic_demo: lluvia histórica 0.6 mm')
ON CONFLICT (site_id, visit_date) DO NOTHING;

-- El seed es opcional y controlado por APP_SEED_DEMO=true. Las migraciones
-- crean la estructura, pero no deben inventar predicciones automáticamente.
-- Estas filas permiten verificar el dashboard inmediatamente después de un
-- despliegue de demostración. El siguiente registro real será procesado por
-- RabbitMQ y el worker ML, reemplazando la predicción del día correspondiente.
WITH stats AS (
  SELECT COALESCE(AVG(total_visitors), 0) AS average_visitors,
         GREATEST(COALESCE(MAX(total_visitors), 1), 1) AS maximum_visitors
  FROM visit_records
  WHERE site_id = '11111111-1111-1111-1111-111111111111'
), targets AS (
  SELECT CURRENT_DATE AS prediction_date
  UNION ALL
  SELECT CURRENT_DATE + 1
), calculated AS (
  SELECT
    t.prediction_date,
    ROUND((s.average_visitors * CASE
      WHEN EXTRACT(ISODOW FROM t.prediction_date) IN (6, 7) THEN 1.4
      ELSE 1.0
    END)::numeric, 2) AS estimated_visitors,
    s.maximum_visitors
  FROM targets t CROSS JOIN stats s
)
INSERT INTO predictions(
  site_id, prediction_date, estimated_visitors, score, level,
  model_version, input_snapshot
)
SELECT
  '11111111-1111-1111-1111-111111111111',
  prediction_date,
  estimated_visitors,
  ROUND(LEAST(100, GREATEST(0, estimated_visitors / maximum_visitors * 100))::numeric, 2),
  CASE
    WHEN estimated_visitors / maximum_visitors * 100 < 40 THEN 'BAJA'
    WHEN estimated_visitors / maximum_visitors * 100 < 70 THEN 'MEDIA'
    ELSE 'ALTA'
  END,
  'baseline-1.0-demo',
  jsonb_build_object(
    'source', 'synthetic_demo',
    'weather_applied', false,
    'note', 'Initial dashboard availability; real daily processing supersedes this row'
  )
FROM calculated
ON CONFLICT (site_id, prediction_date, model_version) DO UPDATE SET
  estimated_visitors = EXCLUDED.estimated_visitors,
  score = EXCLUDED.score,
  level = EXCLUDED.level,
  input_snapshot = EXCLUDED.input_snapshot,
  generated_at = NOW();
