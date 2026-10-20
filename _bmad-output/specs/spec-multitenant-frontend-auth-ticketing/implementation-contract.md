# Contrato de implementación

Este documento es obligatorio para el agente que implemente `SPEC.md`. Debe leer también el código actual antes de modificarlo.

## Backend de autenticación

Agregar un módulo de identidad separado del caso de uso de tickets:

- Migración nueva, por ejemplo `004_auth_users.up.sql`, con `users`, `tenant_memberships` y restricciones únicas.
- `users`: `id`, `email`, `password_hash`, `display_name`, `active`, `created_at`.
- `tenant_memberships`: `user_id`, `tenant_id`, `role`, `created_at`, clave primaria compuesta.
- Seed controlado de una cuenta demo únicamente si `APP_SEED_DEMO=true`; nunca ejecutar el seed destructivo ni borrar el volumen.
- Contraseña con Argon2id o bcrypt. Nunca guardar ni comparar contraseñas en texto plano.
- JWT firmado con una clave obligatoria en producción (`AUTH_JWT_SECRET`). El token debe incluir `sub`, `tenant_id`, `role`, `exp`.
- Middleware Fiber `RequireAuth` que valide firma, expiración, usuario activo y tenant permitido.

Endpoints mínimos:

```text
POST /api/v1/auth/login
GET  /api/v1/auth/me
POST /api/v1/auth/logout
```

`POST /auth/login` recibe `{ "email": "...", "password": "..." }` y devuelve:

```json
{
  "access_token": "jwt",
  "user": { "id": "uuid", "email": "operador@example.com", "display_name": "Operador", "role": "operator" },
  "tenant": { "id": "uuid", "name": "Operador turístico" },
  "sites": [{ "id": "uuid", "code": "derrepente", "name": "Catarata del Río Derrepente", "timezone": "America/Lima" }]
}
```

Todos estos endpoints deben tener pruebas para login correcto, contraseña incorrecta, token expirado, usuario inactivo y tenant no autorizado.

## Autorización tenant-scoped

- El frontend no debe construir el tenant desde `VITE_TENANT_ID` como fuente de autoridad.
- El backend debe tomar `tenant_id` desde el token y comparar cualquier parámetro de ruta con ese tenant.
- Mantener el parámetro de destino en la URL para legibilidad, pero comprobar propiedad con una consulta tenant-scoped.
- Proteger como mínimo: lista/creación de destinos, venta de tickets, importación histórica, clima, predicciones y administración.
- Las rutas legacy de visitas deben quedar marcadas como compatibilidad y no ser usadas por la UI principal.
- Responder `401` sin token, `403` con rol insuficiente y `404` cuando el destino no pertenece al tenant, sin revelar si existe en otro tenant.

## Frontend

Crear estos componentes o equivalentes, reutilizando el sistema de diseño existente:

- `AuthProvider` y `ProtectedRoute`.
- `LoginPage` con validación, loading, error de credenciales y redirección a resumen.
- `TenantContext` que exponga usuario, tenant, destinos, destino activo, cambio de destino y logout.
- `TenantSwitcher` en el encabezado/sidebar con nombre del tenant y destino activo.
- `UserMenu` con identidad, rol y cierre de sesión.
- `TicketSaleForm` con cantidad de 1 a 100, resumen del total, botón deshabilitado durante request y resultado con códigos.
- `TicketSaleHistory` o panel de último resultado con fecha, cantidad y estado.
- `DestinationManagement` que liste destinos del tenant y permita crear uno; no permitir seleccionar IDs escritos manualmente.
- `AuthGuard` que redirija a login cuando el token falte o expire.

La venta debe ejecutar exactamente:

```text
POST /api/v1/tenants/{tenant_id}/sites/{site_id}/tickets
Authorization: Bearer {token}
Content-Type: application/json

{ "quantity": 2 }
```

Debe tratar respuestas así:

| HTTP | UI |
|---|---|
| 201 | Mostrar cantidad y códigos emitidos |
| 400/422 | Mostrar validación junto al formulario |
| 401 | Limpiar sesión y redirigir a login |
| 403 | Mostrar falta de permiso |
| 404 | Mostrar que el destino no pertenece al tenant |
| 409 | Mostrar conflicto de cierre/operación |
| 5xx/network | Mostrar reintento sin duplicar automáticamente la venta |

## Sistema de diseño y sidebar

Conservar `frontend/src/design-system/tokens.css` como capa de tokens. Añadir, si faltan:

- colores semánticos para canvas, surface, elevated, border, text, muted, accent, danger, success y warning;
- escala de espacio, radios, sombras, tipografía y focus ring;
- componentes base `Button`, `Input`, `Select`, `Card`, `Badge`, `Alert`, `DataTable`, `Skeleton` y `EmptyState`;
- variantes de estado con contraste AA y soporte `prefers-reduced-motion`.

El sidebar debe ser independiente del contenido, persistente en desktop y drawer en móvil. Debe contener:

1. Identidad del producto.
2. Tenant y destino activo.
3. Resumen.
4. Ventas.
5. Histórico.
6. Destinos.
7. Administración.
8. Monitoreo.
9. Identidad del usuario y logout.

No duplicar navegación en cada vista. Toda acción debe tener foco visible, etiqueta accesible y estados hover/focus/disabled.

## Predicción y cierre

- El dashboard debe leer las predicciones desde API, nunca inventarlas en frontend.
- Antes del cierre, “Mañana” debe mostrarse como pendiente.
- Después de la hora de cierre, consultar la predicción de mañana y mostrar “procesando” hasta recibirla.
- Cuando cambie la fecha local del destino, la predicción de mañana anterior pasa a ser la de hoy.
- El registro de ticket es la fuente de afluencia; no usar `localStorage` como evidencia de cierre.

## Pruebas obligatorias

Backend:

- login correcto/incorrecto, usuario inactivo, JWT expirado;
- aislamiento entre dos tenants para destinos, clima, predicción, tickets e importación;
- venta válida, cantidad 0, cantidad >100, fecha distinta al día local y token ausente;
- no duplicación de venta en doble click y cierre idempotente.

Frontend:

- usuario no autenticado ve login;
- login exitoso hidrata tenant/destinos y muestra el shell;
- cambio de destino actualiza las llamadas con el destino seleccionado;
- venta correcta muestra códigos;
- venta 401 redirige a login; 409 y 5xx muestran mensajes adecuados;
- un usuario no puede renderizar opciones de otro tenant;
- sidebar desktop/móvil, logout y estados de carga/vacío/error.

Ejecución mínima antes de entregar:

```bash
(cd backend && go test ./...)
(cd ml-service && .venv/bin/python -m pytest)
(cd frontend && npm test && npm run build)
docker compose config
```

Probar manualmente en navegador:

1. Abrir sin token: debe aparecer login.
2. Iniciar sesión con usuario demo.
3. Ver tenant, destinos y usuario en sidebar.
4. Emitir dos tickets y confirmar códigos.
5. Intentar usar un `site_id` de otro tenant: debe fallar.
6. Ejecutar Worker en modo controlado y comprobar que la predicción aparece.
