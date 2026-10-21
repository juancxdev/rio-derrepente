#!/bin/sh
set -eu

DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable"

migrate -path=/migrations -database="${DATABASE_URL}" up
touch /tmp/migrations-complete

# Coolify agrega restart: unless-stopped a los servicios Compose. Mantener
# este contenedor activo evita que vuelva a ejecutar las migraciones.
exec tail -f /dev/null
