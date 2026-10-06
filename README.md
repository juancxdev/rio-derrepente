# Plataforma de afluencia turística

Backend para registrar visitas de la Catarata del Río Derrepente y generar una predicción de afluencia del día siguiente. Usa Go/Fiber, Python/FastAPI, PostgreSQL y RabbitMQ.

## Inicio rápido

```bash
cp .env.example .env
chmod +x scripts/deploy.sh
./scripts/deploy.sh
curl http://localhost:8080/health
curl http://localhost:8000/health
curl http://localhost:3000
```

El dashboard para comercios y encargados está en `http://localhost:3000`. Presenta las predicciones disponibles de hoy y mañana, el pronóstico de Open-Meteo para los siguientes siete días y un formulario de cierre diario. El formulario solo se habilita visualmente desde las 18:00 de `America/Lima`; el backend continúa validando los conteos recibidos.

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

## Pronóstico para el dashboard

El frontend no consulta Open-Meteo de forma directa. El API Go consulta el proveedor y expone una respuesta limitada al destino turístico:

```bash
curl 'http://localhost:8080/api/v1/sites/11111111-1111-1111-1111-111111111111/weather/forecast?days=7'
```

## Migraciones y persistencia

Las migraciones se ejecutan con `golang-migrate` y quedan registradas en la tabla `schema_migrations`. `postgres_data` es un volumen Docker persistente: los despliegues usan `docker compose up` y nunca eliminan el volumen. Por ello, al actualizar código o imágenes, las visitas ya registradas siguen en PostgreSQL y solo se aplican migraciones nuevas.

El seed de seis días es optativo, idempotente y **no contiene visitas reales**: lleva `source=synthetic_demo` y se basa en lluvia histórica de Open-Meteo para demostración. Para cargarlo localmente, define `APP_SEED_DEMO=true` antes de ejecutar `./scripts/deploy.sh`. Nunca debe presentarse como un registro CASTUR.

## Despliegue automático a EC2

El flujo [deploy-ec2.yml](.github/workflows/deploy-ec2.yml) se activa al hacer push a `main`. Primero ejecuta pruebas de Go, Python y el dashboard; después ingresa por SSH al servidor, actualiza con `git pull --ff-only` y ejecuta `scripts/deploy.sh`.

Antes del primer despliegue, clona este repositorio en EC2, instala Docker Compose y configura en GitHub Actions los secretos `EC2_HOST`, `EC2_USER`, `EC2_SSH_PRIVATE_KEY` y `EC2_APP_PATH`. En el servidor, crea un archivo `.env` con una contraseña segura de PostgreSQL. El workflow no contiene esas credenciales ni destruye volúmenes.

## Pruebas

```bash
(cd backend && go test ./...)
(cd ml-service && python -m pip install -r requirements.txt && python -m pytest)
(cd frontend && npm ci && npm run test && npm run build)
```

Para más detalle sobre límites y responsabilidades, consulta [docs/architecture.md](docs/architecture.md).
