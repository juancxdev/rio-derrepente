# Plataforma de afluencia turística

Plataforma multitenant para vender tickets presenciales en destinos turísticos y predecir su afluencia del día siguiente. Usa Go/Fiber, un Worker Go, Python/FastAPI, PostgreSQL y RabbitMQ.

## Inicio rápido

```bash
cp .env.example .env
chmod +x scripts/deploy.sh
./scripts/deploy.sh
curl http://localhost:12001/health
curl http://localhost:12002/health
curl http://localhost:12000
```

El dashboard está en `http://localhost:12000`. El login usa la identidad neutral de la plataforma (Afluencia); el nombre del operador aparece únicamente después de autenticarse. Todas las vistas requieren iniciar sesión; el token vive en memoria y al recargar la página se solicita un nuevo acceso.

Los puertos publicados en el host están reservados en el rango `12000` para evitar choques con Coolify, cAdvisor, Grafana u otros proyectos:

| Servicio | Host | Contenedor |
|---|---:|---:|
| Frontend | `12000` | `80` |
| API | `12001` | `8080` |
| ML | `12002` | `8000` |
| RabbitMQ Management | `12003` | `15672` |

Se configuran con `FRONTEND_HOST_PORT`, `API_HOST_PORT`, `ML_HOST_PORT` y `RABBITMQ_MANAGEMENT_HOST_PORT`.

Los servicios `api`, `ml-service`, `frontend` y `worker` declaran un `healthcheck` en `docker-compose.yml`. La API y el servicio ML exponen `/health`; el frontend se comprueba contra `/` y el worker contra su proceso principal. Coolify usa estos checks al desplegar el Compose.

No hay contraseña de super administrador por defecto. El acceso inicial se crea o se rota con `adminctl`, que solicita la contraseña de forma oculta y la guarda solo como hash bcrypt:

```bash
docker compose --profile tools run --rm adminctl create-superadmin \
  --email superadmin@example.com --name "Super administrador"
```

También puedes generar una contraseña aleatoria y mostrarla una sola vez:

```bash
docker compose --profile tools run --rm adminctl create-superadmin \
  --email superadmin@example.com --generate
```

El comando es idempotente: si el correo ya existe, actualiza la contraseña y mantiene el mismo usuario. No lee contraseñas desde `.env` ni desde `docker-compose.yml`. El super administrador entra a una consola de plataforma donde crea operadores, destinos y la cuenta `admin` de cada operador.

El tenant inicial es `00000000-0000-0000-0000-000000000001` y el sitio inicial tiene el ID `11111111-1111-1111-1111-111111111111`.

## Autenticación local

Cada petición protegida usa `Authorization: Bearer <jwt>`. El token incluye `sub`, `tenant_id`, `role` y `exp`, y el backend toma el tenant desde el token, nunca desde `VITE_TENANT_ID`.

```bash
export TOKEN=$(curl -s -X POST http://localhost:12001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"operador@example.com","password":"<tu-contraseña>"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

curl http://localhost:12001/api/v1/auth/me -H "Authorization: Bearer $TOKEN"
```

La cuenta demo de tenant solo se crea si `APP_SEED_DEMO=true`; nunca borra usuarios, tickets ni cierres existentes. No tiene contraseña por defecto: `DEMO_USER_EMAIL` y `DEMO_USER_PASSWORD` son obligatorios cuando el seed está activo. Los demás campos son `DEMO_USER_NAME` y `DEMO_USER_ROLE` (`operator`, `manager` o `admin`).

El super administrador no pertenece a ningún tenant. Su token lleva `role=super_admin` y `tenant_id` nulo; las rutas `/api/v1/admin/*` comprueban además el flag `is_super_admin` del usuario. Un usuario de tenant recibe `403` y una petición sin token `401`.

```bash
# Login del super administrador
export ADMIN_TOKEN=$(curl -s -X POST http://localhost:12001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@example.com","password":"<tu-contraseña>"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

# Crear un operador
curl -X POST http://localhost:12001/api/v1/admin/tenants \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Operador del valle"}'

# Crear un destino para ese operador (usa el id devuelto arriba)
curl -X POST "http://localhost:12001/api/v1/admin/tenants/$TENANT_ID/sites" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"code":"catarata","name":"Catarata","latitude":-9.295,"longitude":-75.996,"timezone":"America/Lima"}'

# Crear la cuenta admin del operador
curl -X POST http://localhost:12001/api/v1/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@operador.com","display_name":"Admin del operador","password":"<contraseña-del-admin>","tenant_id":"'"$TENANT_ID"'","role":"admin"}'
```

En producción `AUTH_JWT_SECRET` es obligatorio. En desarrollo se usa una clave local con una advertencia en el log. `AUTH_TOKEN_TTL` controla la expiración (8 horas por defecto).

Las contraseñas de usuarios nunca se guardan en `.env`, en `docker-compose.yml` ni en el repositorio. `adminctl` las recibe por terminal o por `--password-stdin` y solo persiste el hash. Para producción, entrega `AUTH_JWT_SECRET` y `DATABASE_URL` mediante el gestor de secretos del servidor, no en un archivo versionado.

Las rutas heredadas de visitas (`/api/v1/sites/{site_id}/visits`) quedan deshabilitadas salvo que se active `APP_ENABLE_LEGACY_ROUTES=true`. Aun así requieren token y comprueban que el sitio pertenezca al tenant autenticado. La interfaz principal no las usa.

## Emitir tickets

```bash
TENANT_ID=00000000-0000-0000-0000-000000000001
SITE_ID=11111111-1111-1111-1111-111111111111

curl -X POST "http://localhost:12001/api/v1/tenants/$TENANT_ID/sites/$SITE_ID/tickets" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-sale-001' \
  -d '{"quantity":3}'
```

La cantidad válida es de 1 a 100. La clave de idempotencia evita duplicar una venta al reintentar o hacer doble clic. Un tenant o sitio ajeno responde `404`, la falta de token `401` y un rol insuficiente `403`.

## Importar histórico

La importación requiere rol `manager` o `admin` y solo se aplica a un destino del tenant autenticado:

```bash
curl -X POST "http://localhost:12001/api/v1/tenants/$TENANT_ID/sites/$SITE_ID/imports?source=operator_csv" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: text/csv' \
  --data-binary $'fecha,total,local,national,foreign\n2024-01-01,35,8,24,3\n'
```

Cada ticket emitido cuenta como una visita real. El Worker cierra cada destino a la hora local indicada por `CLOSURE_HOUR` (18 por defecto): totaliza tickets, guarda clima observado, crea o actualiza el registro diario y publica `daily-closure`. El servicio ML consume ese evento y persiste la predicción del día siguiente. `WORKER_ONCE=true` repara el día anterior de forma controlada.

El dashboard consulta el estado del cierre en `GET /api/v1/tenants/{tenant_id}/sites/{site_id}/closures/{date}`. Antes del cierre, “Mañana” aparece pendiente; después del cierre se consulta la predicción persistida y se muestra “procesando” hasta que el servicio ML la publica.

## Pronóstico para el dashboard

El frontend no consulta Open-Meteo de forma directa. El API Go consulta el proveedor y expone una respuesta limitada al destino turístico:

```bash
curl "http://localhost:12001/api/v1/tenants/$TENANT_ID/sites/$SITE_ID/weather/forecast?days=7" \
  -H "Authorization: Bearer $TOKEN"
```

## Migraciones y persistencia

Las migraciones se ejecutan con `golang-migrate` y quedan registradas en la tabla `schema_migrations`. `postgres_data` es un volumen Docker persistente: los despliegues usan `docker compose up` y nunca eliminan el volumen. Por ello, al actualizar código o imágenes, las visitas ya registradas siguen en PostgreSQL y solo se aplican migraciones nuevas.

El seed de seis días es optativo, idempotente y **no contiene visitas reales**: lleva `source=synthetic_demo` y se basa en lluvia histórica de Open-Meteo para demostración. Para cargarlo localmente, define `APP_SEED_DEMO=true` antes de ejecutar `./scripts/deploy.sh`. El mismo flag crea la cuenta demo si todavía no existe, sin borrar datos operativos. Nunca debe presentarse como un registro CASTUR.

La migración `004_identity_and_idempotency` agrega `users`, `tenant_memberships` y `ticket_sale_requests`. Es aditiva: no elimina tickets, cierres ni visitas existentes. La tabla `ticket_sale_requests` conserva la clave de idempotencia y el resultado de cada venta para que un reintento no emita tickets duplicados.

La migración `005_platform_admin` agrega `users.is_super_admin`. También es aditiva y no modifica tenants, sitios, tickets ni cierres. Para aplicarla sobre un volumen existente sin borrar datos:

```bash
docker compose --profile tools run --rm migrate
docker compose up -d --build api
```

`scripts/deploy.sh` ya ejecuta ambos pasos.

## Despliegue automático a EC2

El flujo [deploy-ec2.yml](.github/workflows/deploy-ec2.yml) se activa al hacer push a `main`. Primero ejecuta pruebas de Go, Python y el dashboard; después ingresa por SSH al servidor, actualiza con `git pull --ff-only` y ejecuta `scripts/deploy.sh`.

Antes del primer despliegue, clona este repositorio en EC2, instala Docker Compose y configura en GitHub Actions los secretos `EC2_HOST`, `EC2_USER`, `EC2_SSH_PRIVATE_KEY` y `EC2_APP_PATH`. En el servidor, crea un archivo `.env` con una contraseña segura de PostgreSQL. El workflow no contiene esas credenciales ni destruye volúmenes.

## Pruebas

```bash
(cd backend && go test ./...)
(cd ml-service && python -m pip install -r requirements.txt && python -m pytest)
(cd frontend && npm ci && npm run test && npm run build)
```

Para más detalle sobre límites y responsabilidades, consulta [docs/architecture.md](docs/architecture.md).
