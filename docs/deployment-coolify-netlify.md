# Despliegue optimizado: Coolify, GHCR y Netlify

## Arquitectura

- Netlify sirve el frontend estático.
- GitHub Actions ejecuta pruebas y construye las imágenes de API/Worker y ML.
- GitHub Container Registry (GHCR) almacena las imágenes.
- Coolify ejecuta `docker-compose.coolify.yml` y descarga las imágenes ya construidas.
- PostgreSQL y RabbitMQ permanecen dentro de Coolify.

## Secrets de GitHub

Configura:

- `NETLIFY_AUTH_TOKEN`: token personal de Netlify.
- `NETLIFY_SITE_ID`: ID del sitio Netlify.
- `VITE_API_BASE_URL`: URL pública de la API, incluyendo protocolo y puerto si aplica.
- `COOLIFY_DEPLOY_WEBHOOK`: webhook de despliegue del recurso en Coolify.

`GITHUB_TOKEN` es proporcionado automáticamente por GitHub Actions y publica las imágenes en GHCR.

## Configuración de Coolify

Usa `docker-compose.coolify.yml` como archivo Compose. Si las imágenes de GHCR son privadas, configura una fuente/registry de GitHub Container Registry con un token que tenga permiso `read:packages`. Alternativamente, publica los paquetes como públicos.

Variables obligatorias del recurso:

```env
POSTGRES_USER=tourism
POSTGRES_PASSWORD=CAMBIAR
POSTGRES_DB=tourism
DATABASE_URL=postgres://tourism:CAMBIAR@postgres:5432/tourism?sslmode=disable
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
AUTH_JWT_SECRET=CAMBIAR
CORS_ALLOWED_ORIGINS=https://TU-SITIO.netlify.app
```

Agrega también las variables opcionales meteorológicas y de operación del `.env.example`.

Después del primer despliegue ejecuta una sola vez:

```bash
docker compose -f docker-compose.coolify.yml --profile tools run --rm migrate
```

Conserva el volumen `postgres_data`. Nunca uses `down -v` en producción.

## Monitoreo bajo demanda

Mantén detenido el recurso de monitoreo de Coolify cuando no se hagan pruebas. Para una prueba, inicia Grafana y Prometheus y sus dependencias; al terminar, detén el recurso completo. No elimines los volúmenes de Grafana o Prometheus para conservar históricos.
