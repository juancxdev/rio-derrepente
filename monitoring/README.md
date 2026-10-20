# Monitoreo local

Stack de observabilidad para ejecutar las pruebas de `tests/k6/` sin depender del VPS y sin publicar los servicios internos de la aplicación.

## Guía rápida

### 1. Levanta la aplicación

El monitoreo se conecta a la red Docker del proyecto, así que la aplicación debe estar arriba:

```bash
./scripts/deploy.sh
```

Comprueba que responde:

```bash
curl http://127.0.0.1:12000
curl http://127.0.0.1:12001/health
curl http://127.0.0.1:12002/health
```

Si la aplicación ya estaba levantada, no hace falta recrearla.

### 2. Levanta el monitoreo

```bash
./scripts/monitoring-up.sh
```

La primera vez se crea `.env.monitoring` con una contraseña aleatoria para Grafana, permisos `600` y excluido de Git. El script también detecta la red Docker del proyecto.

Comprueba los contenedores:

```bash
docker compose --env-file .env.monitoring -f docker-compose.monitoring.yml ps
```

### 3. Crea el fixture de pruebas

Solo hace falta la primera vez. El script crea un tenant, un sitio, un usuario de solo lectura y predicciones para hoy y mañana:

```bash
./scripts/loadtest-setup.py
```

Las credenciales quedan en `.env.loadtest` (modo `600`, ignorado por Git) y `./scripts/load-test.sh` las carga automáticamente.

### 4. Abre Grafana

- URL: `http://127.0.0.1:13000`
- Usuario: `admin`
- Contraseña:

```bash
grep '^GRAFANA_ADMIN_PASSWORD=' .env.monitoring | cut -d= -f2-
```

Deja abierto el dashboard **Afluencia · Pruebas k6**:

```text
http://127.0.0.1:13000/d/afluencia-k6
```

Los dashboards se actualizan automáticamente cada 5 segundos.

### 5. Ejecuta la prueba en otra terminal

```bash
./scripts/load-test.sh smoke-api.js
```

| Prueba | Duración aproximada | Carga | Uso |
|---|---:|---|---|
| `smoke-api.js` | 1 iteración | 1 usuario | Validar login, fixture y endpoints |
| `load-api.js` | 4 min | Hasta 25 usuarios | Medir la carga normal del dashboard |
| `stress-api.js` | 4 min 30 s | Hasta 150 usuarios | Encontrar el punto de degradación |

Las tres pruebas de API recorren `auth/me`, la lista de sitios, el cierre del día y la predicción. No crean tickets ni visitas.

```bash
./scripts/load-test.sh smoke-api.js
./scripts/load-test.sh load-api.js
./scripts/load-test.sh stress-api.js
```

Si solo quieres comprobar que k6, Prometheus y Grafana están conectados, sin credenciales:

```bash
./scripts/load-test.sh smoke-health.js
```

Las métricas se envían a Prometheus y aparecen en Grafana unos segundos después de iniciar la prueba. Para cargar el clima, que depende de Open-Meteo:

```bash
INCLUDE_WEATHER=true ./scripts/load-test.sh smoke-api.js
```

No incluyas el clima en la prueba de estrés. El detalle de variables, umbrales y ejecución desde el host está en [`tests/k6/README.md`](../tests/k6/README.md).

### 6. Consulta los dashboards

| Dashboard | URL | Qué muestra |
|---|---|---|
| Afluencia · Contenedores y host | `http://127.0.0.1:13000/d/afluencia-overview` | CPU, memoria y red por contenedor; CPU y memoria del host; salud HTTP; reinicios |
| Afluencia · Pruebas k6 | `http://127.0.0.1:13000/d/afluencia-k6` | Usuarios virtuales, peticiones por segundo, latencia p95, errores y checks |
| Afluencia · Logs | `http://127.0.0.1:13000/d/afluencia-logs` | Logs de los contenedores y errores o excepciones |

### 7. Detén el monitoreo

```bash
./scripts/monitoring-down.sh
```

## URLs y acceso

| Servicio | URL |
|---|---|
| Grafana | `http://127.0.0.1:13000` |
| Prometheus | `http://127.0.0.1:13090` |
| Alloy UI | `http://127.0.0.1:13001` |

Usuario de Grafana: `admin`. Contraseña: `GRAFANA_ADMIN_PASSWORD` en `.env.monitoring`.

Solo se publican en `127.0.0.1`; Loki, Telegraf, Node Exporter y Blackbox Exporter quedan dentro de la red Docker.

## Componentes

| Componente | Función |
|---|---|
| Prometheus | Guarda métricas y recibe las métricas de k6 por remote write |
| Grafana | Dashboards de contenedores, host, k6 y logs |
| Loki | Almacena logs |
| Alloy | Lee los logs de Docker y los envía a Loki |
| Telegraf | Expone CPU, memoria, red y estado por contenedor usando la API de Docker |
| Node Exporter | Expone CPU, memoria, disco y red del host Linux de Docker |
| Blackbox Exporter | Comprueba `/` y `/health` del frontend, API y ML |
| k6 | Ejecuta las pruebas y publica sus métricas en Prometheus |

## Ejecutar contra otro endpoint

Las pruebas de API usan `API_BASE_URL`. Dentro de Docker apunta a `http://api:8080`; desde el host sería `http://127.0.0.1:12001`. Para cambiarlo sin editar archivos:

```bash
K6_API_BASE_URL=http://api:8080 ./scripts/load-test.sh load-api.js
```

Las pruebas de salud usan `K6_BASE_URL` y, por defecto, llaman a `http://frontend/health`:

```bash
K6_BASE_URL=http://api:8080 K6_TARGET_PATH=/health ./scripts/load-test.sh smoke-health.js
```

Desde el contenedor de k6 debes usar nombres de servicio (`frontend`, `api`, `ml-service`), no `localhost`. El detalle de variables y umbrales está en [`tests/k6/README.md`](../tests/k6/README.md).

## Detener

```bash
./scripts/monitoring-down.sh
```

Para borrar también los datos de Grafana, Prometheus y Loki:

```bash
./scripts/monitoring-down.sh --volumes
```

## Solución de problemas

**`monitoring-up.sh` dice que no encuentra la red Docker**

Levanta primero la aplicación con `./scripts/deploy.sh`. Si usas otro nombre de proyecto, define `APP_NETWORK` en `.env.monitoring`.

**`load-test.sh` dice que faltan credenciales o la prueba falla en el login**

Ejecuta `./scripts/loadtest-setup.py`. Genera `.env.loadtest`; si ya existía, actualiza la contraseña del usuario de pruebas.

**No hay predicción para la fecha de la prueba**

Vuelve a ejecutar `./scripts/loadtest-setup.py` con el servicio ML disponible, o define `PREDICTION_DATE` con una fecha que ya tenga predicción. El detalle está en [`tests/k6/README.md`](../tests/k6/README.md).

**No aparecen métricas de k6 en Grafana**

- Ejecuta la prueba con `./scripts/load-test.sh`; así se activa la salida `experimental-prometheus-rw`.
- Espera 5 a 10 segundos y deja el rango de tiempo del dashboard en los últimos 15 minutos.
- Comprueba en Prometheus que existe la serie `k6_vus`:

```bash
curl --get --data-urlencode 'query=k6_vus' http://127.0.0.1:13090/api/v1/query
```

**No aparecen métricas de contenedores**

```bash
docker logs --tail 50 tourism-monitoring-telegraf-1
docker inspect --format '{{.State.Health.Status}}' tourism-monitoring-telegraf-1
```

En Docker Desktop no se usa cAdvisor; Telegraf lee las métricas desde la API de Docker.

**No aparecen logs**

```bash
docker logs --tail 50 tourism-monitoring-alloy-1
docker logs --tail 50 tourism-monitoring-loki-1
```

El dashboard de logs muestra por defecto la última hora.

**Olvidé la contraseña de Grafana**

```bash
docker compose --env-file .env.monitoring -f docker-compose.monitoring.yml \
  exec grafana grafana cli admin reset-admin-password 'NuevaContraseña'
```

Actualiza también `GRAFANA_ADMIN_PASSWORD` en `.env.monitoring` para mantener la referencia.

**Un puerto está ocupado**

Cambia `MONITORING_GRAFANA_PORT`, `MONITORING_PROMETHEUS_PORT` o `MONITORING_ALLOY_PORT` en `.env.monitoring`, luego ejecuta `./scripts/monitoring-down.sh` y `./scripts/monitoring-up.sh`.

## Por qué Telegraf y no cAdvisor en local

cAdvisor funciona bien en un servidor Linux, pero en Docker Desktop no puede leer el image store de containerd y no expone métricas por contenedor. Telegraf usa la API de Docker, funciona en macOS y Linux, y entrega los mismos datos necesarios para las pruebas: CPU, memoria, red y estado de cada contenedor.

En el VPS puedes mantener cAdvisor si ya lo tienes funcionando; para el entorno local usa Telegraf.

Node Exporter mide el host Linux que Docker Desktop ejecuta en la máquina virtual, no macOS directamente. Para las pruebas de carga es útil porque los contenedores de la aplicación viven en esa misma VM.

## Configuración

- `docker-compose.monitoring.yml`: servicios, puertos y red externa.
- `monitoring/prometheus/prometheus.yml`: targets de Prometheus.
- `monitoring/loki/loki.yml`: almacenamiento local de Loki.
- `monitoring/alloy/config.alloy`: recolección de logs de Docker.
- `monitoring/telegraf/telegraf.conf`: métricas por contenedor.
- `monitoring/blackbox/blackbox.yml`: probes HTTP.
- `monitoring/grafana/`: datasources, provider y dashboards.
- `.env.monitoring.example`: plantilla de variables.
- `scripts/monitoring-up.sh`, `scripts/monitoring-down.sh` y `scripts/load-test.sh`: automatización.

Los puertos de monitoreo están en el rango `13000`, separados de los puertos de la aplicación (`12000–12003`).
