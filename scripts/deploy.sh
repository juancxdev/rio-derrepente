#!/usr/bin/env sh
set -eu

# El volumen postgres_data se conserva entre despliegues. Nunca use `down -v`.
docker compose up -d postgres rabbitmq
docker compose --profile tools run --rm migrate

if [ "${APP_SEED_DEMO:-false}" = "true" ]; then
  docker compose --profile demo run --rm seed-demo
fi

docker compose up -d --build --remove-orphans api ml-service frontend
docker compose ps
