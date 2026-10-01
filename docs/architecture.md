# Arquitectura

La plataforma usa arquitectura hexagonal. En `backend/internal/domain` viven las reglas de negocio; `application` coordina casos de uso a través de puertos; `adapters` implementa HTTP, PostgreSQL, RabbitMQ y observabilidad. El dominio no importa Fiber, pgx ni RabbitMQ.

El backend persiste una visita y publica `VisitRecordCreated`. El servicio ML consume el evento, calcula una predicción del día siguiente y la guarda. Las consultas de predicción solo leen PostgreSQL; nunca activan un trabajo de ML en línea.

La estrategia inicial `baseline-1.0` usa promedio mensual disponible y factores explícitos de lluvia, fin de semana y feriado. Mantiene `model_version` para reemplazar su cálculo por XGBoost sin cambiar el contrato HTTP.

## Mensaje

```json
{
  "event_type": "VisitRecordCreated",
  "visit_record_id": 1,
  "site_id": "11111111-1111-1111-1111-111111111111",
  "prediction_date": "2026-10-02"
}
```

La cola es durable y los mensajes son persistentes. El consumidor es idempotente porque la tabla `predictions` contiene una restricción única por sitio, fecha y versión de modelo.

