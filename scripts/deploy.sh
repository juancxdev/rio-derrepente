#!/usr/bin/env sh
set -eu

# Docker Compose lee .env para interpolar variables, pero el shell que
# ejecuta este script no. Cargarlo aquí permite que APP_SEED_DEMO y el resto
# de la configuración también sean visibles para las decisiones del script.
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

# El volumen postgres_data se conserva entre despliegues. Nunca use `down -v`.
docker compose up -d postgres rabbitmq
docker compose --profile tools run --rm migrate

if [ "${APP_SEED_DEMO:-false}" = "true" ]; then
  docker compose --profile demo run --rm seed-demo
fi

docker compose up -d --build --remove-orphans api ml-service frontend
docker compose ps
