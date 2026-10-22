# Despliegue productivo: Netlify, Cloudflare, GHCR y Coolify

## Arquitectura vigente

- **Netlify** hospeda y construye el frontend desde GitHub usando `netlify.toml`.
- **Cloudflare** administra DNS, TLS y proxy del API: `https://api-afluence-tm.fiis-unas.space`.
- **GitHub Actions** ejecuta pruebas, construye y publica las imágenes de API/Worker, ML y migraciones en GHCR.
- **Coolify** ejecuta `docker-compose.coolify.yml`, descarga las imágenes y administra los recursos del VPS.
- **PostgreSQL, RabbitMQ, API, Worker y ML** viven en la red Docker de aplicación.
- **Grafana, Prometheus, Loki, Alloy, Telegraf, Node Exporter y Blackbox Exporter** viven en el recurso de monitoreo y se encienden durante las pruebas.

## Flujo de entrega

```text
push main
  ├─ Netlify detecta el cambio → build/deploy del frontend
  └─ GitHub Actions → test → build → push a GHCR → POST COOLIFY_WEBHOOK
                                      └─ Coolify pull/redeploy de docker-compose.coolify.yml
```

Coolify ya no debe considerarse un despliegue automático por cada push. El recurso se mantiene en despliegue manual; GitHub Actions dispara el hook únicamente después de publicar correctamente las imágenes. No se usa un segundo flujo SSH con `git pull` para la misma aplicación.

## Variables de Netlify

Netlify se vincula directamente con GitHub. No requiere `NETLIFY_AUTH_TOKEN` ni `NETLIFY_SITE_ID` en GitHub Actions. En Netlify configura:

```env
VITE_API_BASE_URL=https://api-afluence-tm.fiis-unas.space
```

El dominio de Netlify debe estar incluido en `CORS_ALLOWED_ORIGINS` del API.

## Variables de Coolify

El recurso de aplicación debe usar `docker-compose.coolify.yml`. Las imágenes de GHCR deben estar públicas o Coolify debe tener configurado un registry privado con permiso `read:packages`.

Variables mínimas:

```env
POSTGRES_USER=tourism
POSTGRES_PASSWORD=CAMBIAR
POSTGRES_DB=tourism
DATABASE_URL=postgres://tourism:CAMBIAR@postgres:5432/tourism?sslmode=disable
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
AUTH_JWT_SECRET=CAMBIAR
CORS_ALLOWED_ORIGINS=https://afluence-tm.netlify.app
API_HOST_PORT=12001
APP_SEED_DEMO=false
```

Las migraciones se ejecutan mediante el servicio `migrate` del Compose y quedan registradas por `golang-migrate`; no se deben ejecutar todas nuevamente ni eliminar `postgres_data`. `down -v` está prohibido en producción.

## Cloudflare

Crear un registro DNS para `api-afluence-tm.fiis-unas.space` apuntando a la IP pública del VPS y activar el proxy. En Coolify, el dominio del servicio API debe ser `https://api-afluence-tm.fiis-unas.space`; el proxy de Coolify enruta al puerto interno `8080` y publica el servicio por HTTPS. No se debe usar `/health` como prefijo del dominio.

## Monitoreo

El recurso `monitoring-stack` se administra por separado en Coolify. Durante las pruebas se inician Grafana, Prometheus y sus dependencias:

- Telegraf: métricas de Docker mediante socket/API, puerto interno `9273`.
- Node Exporter: métricas del VPS, `9100`.
- Blackbox Exporter: sondas HTTP de API y frontend, `9115`.
- Prometheus: scraping y almacenamiento de métricas, `9090`.
- Alloy: lectura de logs Docker.
- Loki: almacenamiento de logs, `3100`.
- Grafana: dashboards, `3000`.

Después de las pruebas se puede detener el recurso completo, conservando los volúmenes de Grafana, Prometheus y Loki.

## Verificación después de un deploy

```bash
curl -fsS https://api-afluence-tm.fiis-unas.space/health
docker compose -f docker-compose.coolify.yml ps
docker compose -f docker-compose.coolify.yml logs --tail=100 migrate api worker ml-service
```

En Coolify también se debe confirmar que el despliegue utilizó las etiquetas `:latest` recién publicadas y que el healthcheck del API y ML está saludable.
