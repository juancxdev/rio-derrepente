#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env.monitoring"
DEFAULT_NETWORK="proyecto-aplicaciones-para-la-nube_default"

if [ ! -f "$ENV_FILE" ]; then
  umask 077
  network="${APP_NETWORK:-$DEFAULT_NETWORK}"

  if ! docker network inspect "$network" >/dev/null 2>&1; then
    network="$(docker network ls --format '{{.Name}}' | grep -E 'proyecto-aplicaciones-para-la-nube.*_default' | head -n 1 || true)"
  fi

  if [ -z "$network" ]; then
    echo "No encuentro la red Docker de la aplicación." >&2
    echo "Ejecuta ./scripts/deploy.sh primero o define APP_NETWORK." >&2
    exit 1
  fi

  password="$(openssl rand -hex 24)"

  cat > "$ENV_FILE" <<EOF
GRAFANA_ADMIN_PASSWORD=$password
APP_NETWORK=$network
MONITORING_BIND_ADDRESS=127.0.0.1
MONITORING_GRAFANA_PORT=13000
MONITORING_PROMETHEUS_PORT=13090
MONITORING_ALLOY_PORT=13001
K6_BASE_URL=http://frontend
K6_TARGET_PATH=/health
K6_API_BASE_URL=http://api:8080
EOF
  chmod 600 "$ENV_FILE"
  echo "Creado $ENV_FILE con una contraseña aleatoria para Grafana."
fi

set -a
# shellcheck source=/dev/null
. "$ENV_FILE"
set +a

network="${APP_NETWORK:-$DEFAULT_NETWORK}"
if ! docker network inspect "$network" >/dev/null 2>&1; then
  echo "La red Docker '$network' no existe." >&2
  echo "Ejecuta ./scripts/deploy.sh o ajusta APP_NETWORK en $ENV_FILE." >&2
  exit 1
fi

if [ -z "${GRAFANA_ADMIN_PASSWORD:-}" ]; then
  echo "GRAFANA_ADMIN_PASSWORD está vacía en $ENV_FILE." >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f docker-compose.monitoring.yml up -d

bind="${MONITORING_BIND_ADDRESS:-127.0.0.1}"
grafana_port="${MONITORING_GRAFANA_PORT:-13000}"
prometheus_port="${MONITORING_PROMETHEUS_PORT:-13090}"
alloy_port="${MONITORING_ALLOY_PORT:-13001}"

printf '\nMonitoreo iniciado.\n'
printf '  Grafana:    http://%s:%s  (usuario: admin)\n' "$bind" "$grafana_port"
printf '  Prometheus: http://%s:%s\n' "$bind" "$prometheus_port"
printf '  Alloy UI:   http://%s:%s\n' "$bind" "$alloy_port"
printf '  Contraseña: %s/%s (variable GRAFANA_ADMIN_PASSWORD)\n' "$ROOT_DIR" "$ENV_FILE"
printf '\nPrueba rápida: ./scripts/loadtest-setup.py && ./scripts/load-test.sh smoke-api.js\n'
printf 'Sin credenciales: ./scripts/load-test.sh smoke-health.js\n'
