# Modelo de plataforma

## Identidades

| Identidad | Alcance | Acceso |
|---|---|---|
| `super_admin` | Plataforma completa | Consola de plataforma y todas las rutas `/api/v1/admin/*` |
| `admin` | Un tenant | Consola del tenant, destinos, importación, ventas |
| `manager` | Un tenant | Consola del tenant, destinos, importación, ventas |
| `operator` | Un tenant | Consola del tenant y ventas |

El super administrador no tiene membresía de tenant. Su usuario lleva `is_super_admin=true`; el token incluye `role=super_admin` y `tenant_id` nulo. Las rutas de tenant siguen rechazando cualquier tenant distinto al del token.

## Rutas de plataforma

```text
GET  /api/v1/admin/tenants
POST /api/v1/admin/tenants              { "name": "..." }
GET  /api/v1/admin/tenants/{id}/sites
POST /api/v1/admin/tenants/{id}/sites   { "code", "name", "latitude", "longitude", "timezone" }
GET  /api/v1/admin/users
POST /api/v1/admin/users                { "email", "display_name", "password", "tenant_id", "role" }
```

- `GET /api/v1/admin/tenants` devuelve cada operador con su cantidad de destinos y cuentas.
- `GET /api/v1/admin/users` devuelve correo, nombre, estado, tenant y rol.
- `POST /api/v1/admin/users` crea o actualiza la cuenta y su membresía en el tenant indicado. La contraseña se hashea con bcrypt y nunca se devuelve.
- Los errores de validación responden `422`; un tenant inexistente responde `404`; un correo duplicado actualiza la cuenta existente solo si el super administrador lo envía de nuevo.

## Flujo de puesta en marcha

1. Un operador técnico crea el super administrador con `adminctl create-superadmin`, eligiendo el correo y una contraseña de al menos 12 caracteres.
2. El super administrador inicia sesión en la pantalla neutral.
3. Crea un operador turístico.
4. Crea uno o más destinos para ese operador.
5. Crea la cuenta `admin` del operador con correo, nombre y contraseña.
6. El admin del operador inicia sesión en la misma pantalla y ve únicamente su tenant y sus destinos.

## Configuración

No hay variables de contraseña. El único dato de conexión es `DATABASE_URL`, que debe venir del entorno o del gestor de secretos del servidor.

```bash
# Crear o rotar el super administrador con prompt oculto
docker compose --profile tools run --rm adminctl create-superadmin \
  --email superadmin@example.com --name "Super administrador"

# Alternativa para automatización: generar y mostrar una sola vez
docker compose --profile tools run --rm adminctl create-superadmin \
  --email superadmin@example.com --generate
```

`adminctl` es idempotente: actualiza la contraseña y el nombre del usuario existente sin tocar tenants, sitios, tickets ni cierres. Solo persiste el hash bcrypt. No lee contraseñas de `.env` ni de `docker-compose.yml`.
