#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env.monitoring"
LOAD_ENV_FILE=".env.loadtest"
if [ ! -f "$ENV_FILE" ]; then
  echo "No existe $ENV_FILE. Ejecuta ./scripts/monitoring-up.sh primero." >&2
  exit 1
fi

env_file_value() {
  awk -v key="$1" -F= '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

# Las credenciales de las pruebas viven en .env.loadtest, generado por
# scripts/loadtest-setup.py. Las variables del shell tienen prioridad.
if [ -f "$LOAD_ENV_FILE" ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      ''|\#*) continue ;;
    esac
    if [ -z "${!key:-}" ]; then
      export "$key=$value"
    fi
  done < "$LOAD_ENV_FILE"
fi

# Las variables del shell tienen prioridad sobre .env.monitoring. No se hace
# `source` para no sobrescribir K6_BASE_URL/K6_TARGET_PATH del usuario.
base_url="${K6_BASE_URL:-$(env_file_value K6_BASE_URL)}"
base_url="${base_url:-http://frontend}"
api_base_url="${K6_API_BASE_URL:-$(env_file_value K6_API_BASE_URL)}"
api_base_url="${api_base_url:-http://api:8080}"
bind="${MONITORING_BIND_ADDRESS:-$(env_file_value MONITORING_BIND_ADDRESS)}"
bind="${bind:-127.0.0.1}"
grafana_port="${MONITORING_GRAFANA_PORT:-$(env_file_value MONITORING_GRAFANA_PORT)}"
grafana_port="${grafana_port:-13000}"

script="${1:-load-health.js}"
shift || true

case "$script" in
  /*) script_path="$script" ;;
  *) script_path="/scripts/$script" ;;
esac

if [[ "$script" == *-api.js ]] && [ -z "${TEST_EMAIL:-}" ]; then
  echo "Faltan credenciales para las pruebas de API." >&2
  echo "Ejecuta primero: ./scripts/loadtest-setup.py" >&2
  exit 1
fi

printf 'Ejecutando %s\n' "$script_path"
printf '  API:    %s\n' "$api_base_url"
printf '  Health: %s\n' "$base_url"
printf 'Dashboard: http://%s:%s/d/afluencia-k6\n\n' "$bind" "$grafana_port"

docker compose --env-file "$ENV_FILE" -f docker-compose.monitoring.yml \
  --profile loadtest run --rm k6 \
  run --out experimental-prometheus-rw "$script_path" "$@"
