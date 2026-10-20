# Pruebas k6 contra la aplicación en Coolify

Estos scripts no crean tickets ni modifican datos. Por defecto prueban el endpoint público `GET /health` a través del frontend.

## URL con la configuración actual

El `docker-compose.yml` publica el frontend en `3000:80`, por lo que la URL inicial es:

```bash
export BASE_URL=http://69.164.247.232:3000
```

Si Coolify publica el frontend mediante el proxy en el puerto 80, usa:

```bash
export BASE_URL=http://69.164.247.232
```

Comprueba primero:

```bash
curl "$BASE_URL/health"
```

## Carga normal

```bash
k6 run -e BASE_URL="$BASE_URL" tests/k6/load-health.js
```

Perfil: 10 usuarios virtuales durante dos minutos, con incremento y descenso controlados.

## Estrés

```bash
k6 run -e BASE_URL="$BASE_URL" tests/k6/stress-health.js
```

Perfil: incremento progresivo hasta 100 usuarios virtuales. La prueba debe ejecutarse cuando la aplicación esté disponible y después observar Grafana durante todo el intervalo.

## Endpoint protegido de lectura

Cuando tengas un token de autenticación y quieras probar la lista de destinos sin crear datos:

```bash
export AUTH_TOKEN='TOKEN_DE_PRUEBA'
export TARGET_PATH='/api/v1/tenants/TENANT_ID/sites'
k6 run -e BASE_URL="$BASE_URL" -e AUTH_TOKEN="$AUTH_TOKEN" -e TARGET_PATH="$TARGET_PATH" tests/k6/load-health.js
```

No uses el endpoint de venta para una prueba masiva: cada `POST` crea tickets persistentes.

## Qué observar en Grafana

- CPU y memoria del contenedor `api` y `frontend` en cAdvisor.
- CPU, memoria, disco y red del VPS en Node Exporter.
- Logs de `api`, `worker` y `ml-service` en Loki.
- Errores HTTP y reinicios de contenedores.
- Latencia p95 y tasa de errores reportadas por k6.
