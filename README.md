# Plataforma de afluencia turística

Backend para registrar visitas de la Catarata del Río Derrepente y generar una predicción de afluencia del día siguiente. Usa Go/Fiber, Python/FastAPI, PostgreSQL y RabbitMQ.

## Inicio rápido

```bash
cp .env.example .env
docker compose up --build -d
curl http://localhost:8080/health
curl http://localhost:8000/health
```

El sitio inicial tiene el ID `11111111-1111-1111-1111-111111111111`.

## Registrar visitas

```bash
curl -X POST http://localhost:8080/api/v1/sites/11111111-1111-1111-1111-111111111111/visits \
  -H 'Content-Type: application/json' \
  -d '{"visit_date":"2026-10-01","local_visitors":8,"national_visitors":18,"foreign_visitors":2,"total_visitors":28}'
```

Después de que el worker procese el evento, consulta la predicción:

```bash
curl http://localhost:8080/api/v1/sites/11111111-1111-1111-1111-111111111111/predictions/2026-10-02
```

## Pruebas

```bash
(cd backend && go test ./...)
(cd ml-service && python3 -m pytest)
```

Para más detalle sobre límites y responsabilidades, consulta [docs/architecture.md](docs/architecture.md).

