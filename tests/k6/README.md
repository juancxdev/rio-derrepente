# Pruebas k6

El repositorio tiene dos familias de pruebas:

- **Salud** (`*-health.js`): comprueban que la infraestructura responde. No necesitan credenciales.
- **API** (`*-api.js`): simulan la carga de lectura del dashboard autenticado. Son las pruebas recomendadas para medir la aplicación.

Ninguna prueba crea tickets, visitas ni cierres. El endpoint `POST` de venta queda fuera porque cada llamada persiste datos.

La guía completa para levantar el monitoreo, abrir Grafana y ejecutar las pruebas está en [`monitoring/README.md`](../../monitoring/README.md). El dashboard de resultados es `http://127.0.0.1:13000/d/afluencia-k6`.

## Preparación local

Con la aplicación y el monitoreo levantados:

```bash
./scripts/deploy.sh
./scripts/monitoring-up.sh
```

Crea una vez el fixture de pruebas:

```bash
./scripts/loadtest-setup.py
```

El script necesita el super administrador. Por defecto lee la contraseña de `.local/superadmin-password.txt`; también puedes pasarla con `SUPERADMIN_PASSWORD`. Crea o reutiliza:

- Un tenant llamado `Pruebas de carga`.
- Un sitio con código `loadtest`.
- Un usuario `loadtest@example.com` con rol `operator` (solo lectura).
- Una predicción para hoy y otra para mañana.
- `.env.loadtest` con las credenciales, en modo `600` e ignorado por Git.

El fixture es aditivo: no borra ni modifica datos de otros tenants. Si lo ejecutas de nuevo, actualiza la contraseña del usuario y reutiliza tenant y sitio.

## Pruebas de API

| Prueba | Duración aproximada | VUs máximos | Objetivo |
|---|---:|---:|---|
| `smoke-api.js` | 1 iteración | 1 | Validar login, fixture y endpoints antes de cargar |
| `load-api.js` | 4 min | 25 | Medir el comportamiento con carga normal |
| `stress-api.js` | 4 min 30 s | 150 | Encontrar el punto de degradación |

```bash
./scripts/load-test.sh smoke-api.js
./scripts/load-test.sh load-api.js
./scripts/load-test.sh stress-api.js
```

Cada iteración hace el flujo de lectura del dashboard:

1. `GET /api/v1/auth/me`
2. `GET /api/v1/tenants/{tenant}/sites`
3. `GET /api/v1/tenants/{tenant}/sites/{site}/closures/{fecha}`
4. `GET /api/v1/tenants/{tenant}/sites/{site}/predictions/{fecha}`

El login se hace una sola vez en `setup()` y el token se comparte entre los VUs. Así la prueba mide la API y no el costo de bcrypt en cada iteración.

Umbrales:

- `load-api.js`: errores menores de 1 %, p95 menor de 500 ms, p99 menor de 1000 ms y checks mayores de 99 %.
- `stress-api.js`: errores menores de 10 %, p95 menor de 3000 ms, p99 menor de 5000 ms y checks mayores de 95 %. El estrés busca el límite; un fallo de umbral es un resultado a analizar, no necesariamente un error del script.

Puedes ajustar la carga sin editar archivos:

```bash
LOAD_PEAK=50 ./scripts/load-test.sh load-api.js
STRESS_PEAK=100 STRESS_SLEEP=0.1 ./scripts/load-test.sh stress-api.js
```

`STRESS_SLEEP` es el tiempo de espera entre iteraciones durante el estrés. El valor por defecto es `0.2` segundos; usa `0` solo si quieres generar la mayor carga posible.

### Clima

El endpoint de clima depende de Open-Meteo y queda fuera por defecto para no mezclar fallos externos con la capacidad de la plataforma. Para incluirlo en el smoke o en la carga:

```bash
INCLUDE_WEATHER=true ./scripts/load-test.sh smoke-api.js
INCLUDE_WEATHER=true WEATHER_DAYS=1 ./scripts/load-test.sh load-api.js
```

No lo incluyas en la prueba de estrés: Open-Meteo puede limitar la tasa de peticiones y el resultado dejaría de medir tu servidor.

## Pruebas de salud

Sirven para comprobar k6, Prometheus, Grafana y la red sin depender de credenciales:

| Prueba | Duración | VUs | Uso |
|---|---:|---:|---|
| `smoke-health.js` | 10 s | 2 | Comprobación rápida del monitoreo |
| `load-health.js` | 3 min | 10 | Carga ligera sobre `/health` |
| `stress-health.js` | 3 min 30 s | 100 | Estrés del endpoint de salud |

```bash
./scripts/load-test.sh smoke-health.js
./scripts/load-test.sh load-health.js
./scripts/load-test.sh stress-health.js
```

Por defecto llaman a `GET /health` del frontend dentro de la red Docker. Para cambiarlo:

```bash
K6_BASE_URL=http://api:8080 K6_TARGET_PATH=/health ./scripts/load-test.sh smoke-health.js
```

## Variables

`./scripts/load-test.sh` carga `.env.loadtest` automáticamente. Las variables del shell tienen prioridad.

| Variable | Uso | Valor por defecto |
|---|---|---|
| `API_BASE_URL` | Base de la API dentro del contenedor k6 | `http://api:8080` |
| `TEST_EMAIL` | Usuario de pruebas | Se lee de `.env.loadtest` |
| `TEST_PASSWORD` | Contraseña del usuario | Se lee de `.env.loadtest` |
| `TEST_TENANT_ID` | Tenant a validar | Se lee de `.env.loadtest` |
| `TEST_SITE_ID` | Sitio a consultar | Se lee de `.env.loadtest` |
| `TEST_SITE_CODE` | Alternativa al ID del sitio | Vacío |
| `PREDICTION_DATE` | Fecha de la predicción | Hoy |
| `TARGET_DATE` | Fecha del cierre diario | Hoy |
| `INCLUDE_WEATHER` | Añadir la llamada al clima | `false` |
| `WEATHER_DAYS` | Días de pronóstico (1 a 7) | `1` |
| `LOAD_PEAK` | VUs máximos de carga | `25` |
| `STRESS_PEAK` | VUs máximos de estrés | `150` |
| `STRESS_SLEEP` | Pausa entre iteraciones de estrés | `0.2` |
| `K6_API_BASE_URL` | Base de la API para Docker | `http://api:8080` |

## Ejecutar desde el host

Si tienes k6 instalado localmente:

```bash
set -a
. ./.env.loadtest
set +a

export API_BASE_URL=http://127.0.0.1:12001

k6 run tests/k6/smoke-api.js
k6 run tests/k6/load-api.js
k6 run tests/k6/stress-api.js
```

Las pruebas de salud desde el host:

```bash
BASE_URL=http://127.0.0.1:12000 k6 run tests/k6/smoke-health.js
BASE_URL=http://127.0.0.1:12000 k6 run tests/k6/load-health.js
BASE_URL=http://127.0.0.1:12000 k6 run tests/k6/stress-health.js
```

## Ejecutar contra el servidor

Primero prepara el fixture contra la API publicada. Si el servicio ML no está expuesto, desactiva el seed y usa una fecha que ya tenga predicción:

```bash
API_BASE_URL=https://api.tu-dominio.example \
SUPERADMIN_PASSWORD='...' \
SEED_PREDICTIONS=false \
PREDICTION_DATE=2026-10-21 \
./scripts/loadtest-setup.py
```

Luego ejecuta las pruebas con la API del servidor:

```bash
K6_API_BASE_URL=https://api.tu-dominio.example \
./scripts/load-test.sh smoke-api.js

K6_API_BASE_URL=https://api.tu-dominio.example \
./scripts/load-test.sh load-api.js
```

No ejecutes `stress-api.js` contra producción sin una ventana de mantenimiento y sin avisar a los usuarios. Ajusta `STRESS_PEAK` según el tamaño del servidor.

## Qué observar en Grafana

- Latencia p95 y p99 por endpoint: `me`, `sites`, `closure`, `prediction` y, si se activa, `weather`.
- Peticiones por segundo, VUs, checks y errores HTTP.
- CPU y memoria por contenedor (`api`, `postgres`, `ml-service`, etc.).
- CPU y memoria del host de Docker.
- Reinicios de contenedores.
- Logs de la API y errores en Loki.

## Problemas frecuentes

**`Faltan credenciales para las pruebas de API`**

Ejecuta `./scripts/loadtest-setup.py`. El script crea `.env.loadtest`.

**`No hay predicción disponible para hoy ni para mañana`**

Vuelve a ejecutar el setup con el servicio ML disponible, o define `PREDICTION_DATE` con una fecha que ya tenga predicción.

**Login con HTTP 401**

La contraseña de `.env.loadtest` quedó desactualizada. Ejecuta de nuevo el setup; actualiza la contraseña del usuario y el archivo.

**HTTP 404 en `sites`, `closures` o `predictions`**

El usuario y el tenant del token no coinciden con `TEST_TENANT_ID`/`TEST_SITE_ID`. Borra `.env.loadtest` y vuelve a ejecutar el setup.

**El clima tarda o devuelve 429**

Es una dependencia externa. Deja `INCLUDE_WEATHER=false` para las pruebas de capacidad.

**El estrés degrada demasiado el equipo local**

Baja `STRESS_PEAK` o sube `STRESS_SLEEP`. En local no necesitas llegar a 150 VUs para demostrar que el monitoreo funciona.
