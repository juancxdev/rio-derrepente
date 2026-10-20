#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env.monitoring"
if [ -f "$ENV_FILE" ]; then
  docker compose --env-file "$ENV_FILE" -f docker-compose.monitoring.yml down "$@"
else
  GRAFANA_ADMIN_PASSWORD=unused docker compose -f docker-compose.monitoring.yml down "$@"
fi
