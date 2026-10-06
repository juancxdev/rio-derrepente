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
