---
title: 'Plataforma multitenant de tickets y cierre diario'
type: 'feature'
created: '2026-10-20'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context: []
baseline_commit: 'd8aa4672f839aa1d93fbed22fb9a4806972ed0c2'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** La plataforma registra una única catarata mediante un cierre manual y el servicio ML recibe un evento por cada registro. No permite operar varios destinos ni usar ventas presenciales como fuente real, por lo que el dato diario y el entrenamiento no representan el flujo comercial definido.

**Approach:** Convertirla en una base multitenant con destinos, tickets presenciales e importación histórica. Un Worker Go cerrará cada destino de manera idempotente, consolidará sus tickets, guardará el registro diario con clima y publicará un único evento para que ML genere la predicción siguiente.

## Boundaries & Constraints

**Always:** Conservar datos ya persistidos y rutas de lectura actuales; aplicar migraciones aditivas con golang-migrate; filtrar escritura y lectura nueva por tenant y destino; tratar un ticket emitido como una visita real; hacer el cierre repetible sin duplicar asistencia ni eventos; utilizar Open-Meteo desde el Worker para el clima; mantener PostgreSQL como fuente de verdad y RabbitMQ como desacoplamiento; crear un sistema de diseño con tokens y componentes reutilizables para el frontend.

**Never:** No eliminar volúmenes, tablas ni registros existentes; no desplegar ni subir a GitHub; no presentar datos sintéticos como históricos oficiales; no incorporar pasarela de pago, QR, escáner ni autenticación completa en este incremento; no copiar el código del POS, solo tomar su patrón de sidebar adaptable como referencia.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Crear destino | Tenant válido y nombre, coordenadas y zona horaria | Destino aislado dentro del tenant | 422 para campos inválidos; 404 para tenant inexistente |
| Venta presencial | Cantidad positiva para un destino | Se emite un ticket por visita y se devuelve código(s) de emisión | 422 para cantidad inválida; 404 para tenant/destino no relacionados |
| Importación CSV | Filas fecha, total y desglose opcional | Upsert de histórico con fuente declarada y resumen de filas | Rechazar filas inválidas sin persistencia parcial |
| Cierre diario | Tickets de una fecha, incluso con reintento | Un `visit_record` de origen `ticket_sales`, clima observado y un evento `daily-closure` | Upsert idempotente; fallo de cola queda registrado para reintento |
| Predicción | Evento `daily-closure` de tenant/destino | ML usa solamente el historial del destino y persiste la predicción siguiente | Nack/requeue del evento ante error transitorio |
| UI operativa | Destino seleccionado | Sidebar escalable con resumen, ventas, histórico y administración | Estados claros de carga, vacío y error; móvil usa drawer accesible |

</frozen-after-approval>

## Code Map

- `db/migrations/001_initial.up.sql` y `002_add_visit_source.up.sql` -- esquema existente que debe evolucionar de forma aditiva, incluida la catarata semilla.
- `backend/internal/adapters/http/api.go` -- rutas Fiber actuales para visitas, pronósticos y predicciones; extender sin romper lecturas heredadas.
- `backend/internal/adapters/postgres/repositories.go` -- repositorio pgx único actual; separar consultas por agregado de tenant, destino, ticket y cierre.
- `backend/internal/application/ports.go` y `visit_service.go` -- puertos y caso de uso de registro manual; conservar como compatibilidad y añadir casos de uso nuevos.
- `backend/internal/adapters/rabbitmq/publisher.go` -- contrato actual `visit-record-created`; añadir `daily-closure` durable.
- `backend/internal/adapters/weather/open_meteo.go` -- adaptador que puede reutilizarse por el Worker para observado y pronóstico.
- `backend/cmd/api/main.go` y `backend/Dockerfile` -- composición de API; construir también `cmd/worker` en la misma imagen.
- `ml-service/app/infrastructure/worker.py` y `database.py` -- consumidor y consultas ML, a migrar al contrato de cierre y a datos por tenant/destino.
- `frontend/src/App.tsx`, `styles.css`, `components/*`, `api/*` -- dashboard React actual; extraer tokens, shell/sidebar y módulos de venta, destinos e importación.
- `/Users/juancx/Documents/CX-Developments/FREELANCE/POS/apps/web/src/app/shell/app-shell.component.ts` -- referencia externa de sidebar colapsable/drawer, sin copiar implementación.

## Tasks & Acceptance

**Execution:**
- [x] `db/migrations/003_multitenant_ticketing.*.sql` -- crear tenants, relación de destinos, tickets, importaciones y soporte de cierre idempotente.
- [x] `backend/internal/domain/{tenants,sites,tickets}/` y `backend/internal/application/` -- modelar y validar casos de uso nuevos con puertos SOLID.
- [x] `backend/internal/adapters/{http,postgres,rabbitmq}/` -- exponer API tenant-scoped, CSV transaccional, venta de tickets y evento de cierre.
- [x] `backend/cmd/worker/` -- programar el cierre local por zona horaria y permitir ejecución única verificable.
- [x] `ml-service/app/` -- consumir `daily-closure` y entrenar/generar por destino sin mezclar tenants.
- [x] `docker-compose.yml`, `backend/Dockerfile`, `.env.example`, `scripts/deploy.sh` -- incluir Worker sin afectar volumen ni orden de migración.
- [x] `frontend/src/{design-system,components,api}` y `App.tsx` -- implantar sistema de diseño, navegación lateral y flujos operativos de tickets/histórico/destinos.
- [x] pruebas Go, Python y React -- cubrir validación, aislamiento, CSV, cierre idempotente y UI de venta.

**Acceptance Criteria:**
- Given dos tenants con destinos distintos, when se crea un ticket o se consulta un recurso tenant-scoped, then no se expone ni agrega información de otro tenant.
- Given ventas emitidas para un destino, when el Worker cierra la fecha dos veces, then existe un solo registro diario y una sola predicción actualizada para el día siguiente.
- Given un CSV con una fila inválida, when se importa, then la importación falla de forma legible y no deja filas parciales.
- Given el despliegue se actualiza, when se ejecutan migraciones y servicios, then el volumen de PostgreSQL y tickets previos se conservan.
- Given un operador usa el frontend, when abre Ventas, Histórico o Destinos, then cada módulo reutiliza los tokens, shell y componentes base y mantiene navegación accesible en escritorio y móvil.

## Implementation Notes

- La primera entrega implementa aislamiento de datos mediante rutas tenant-scoped. Identidad, roles y sesión quedan como el siguiente incremento de seguridad, fuera del alcance solicitado.

## Spec Change Log

## Review Triage Log

- `high / patch` — El Worker podía omitir un día si empezaba después de la hora exacta; el cierre deberá ejecutarse desde la hora configurada en adelante y seguirá siendo idempotente.
- `high / patch` — El pronóstico tenant-scoped usaba coordenadas globales; se cargará el destino propietario y se usarán sus coordenadas y zona horaria.
- `medium / patch` — La venta presencial aceptaba fechas pasadas o futuras; se restringirá al día local actual del destino para no invalidar un cierre ya consolidado.
- `medium / patch` — No existía límite de cantidad por venta; se validará un máximo por operación para evitar consumo desproporcionado.
- `false` — Se reportó un import ausente de `strings` en una prueba Go; `go test ./...` compiló y pasó con el import presente.
- `medium / patch` — La base almacenaba tenant y destino sin una FK compuesta; se añadieron índice único compuesto y FKs para que PostgreSQL preserve el aislamiento.
- `medium / patch` — El down original eliminaba datos persistidos; se convirtió en migración irreversible explícita para respetar la preservación de datos.
- `medium / patch` — Listar destinos de un tenant inexistente devolvía una colección vacía; se validará la existencia del tenant antes de responder.
- `medium / patch` — La consola permitía seleccionar destinos pero no crearlos; se añadirá el formulario de alta tenant-scoped.
- `low / patch` — Parámetros `tenant_id` sin uso en tablas con `site_id` UUID global podían confundir; se documentará o retirará de las operaciones donde la pertenencia ya se garantiza por el destino.
- `medium / patch` — Un fallo permanente del consumidor podía reencolarse sin límite; se incorporará manejo acotado de reintentos o descarte controlado.
- `medium / patch` — Un CSV podía sobrescribir una fecha ya cerrada con tickets; la importación protegerá cierres existentes.
- `defer` — La ruta manual heredada conserva compatibilidad de escritura pero ya no desencadena ML; el flujo aprobado de producción es la venta/cierre diario y la migración completa de la ruta manual requiere un contrato tenant adicional.
- `false` — Un fallo al marcar el evento tras publicarlo puede causar entrega repetida, pero el consumidor persiste predicciones con upsert por destino/fecha/modelo; no se duplica la predicción.
- `medium / patch` — Faltaba prueba de reintento luego de un fallo de publicación; se añadirá una prueba enfocada.
- `medium / patch` — Faltaba prueba de contrato productor/consumidor para `daily-closure`; se añadirá prueba de callback ML con tenant, destino y fecha.
- `medium / patch` — Faltaba prueba del formulario de ventas y forma de request tenant-scoped; se añadirá prueba de UI.
- `maybe-false / defer` — La consulta meteorológica histórica requiere validar en integración el tratamiento de `timezone` del proveedor para destinos fuera de Perú; los destinos inicialmente operados usan `America/Lima`.

## Design Notes

Diseño: consola operacional de tema oscuro existente, reorganizada con tokens CSS semánticos, shell de navegación persistente, drawer móvil y componentes de formulario/estado compartidos. Densidad visual 7, varianza 4 y movimiento 3: prioridad a ventas rápidas, legibilidad y estados auditables.

## Verification

**Commands:**
- `(cd backend && go test ./...)` -- esperado: casos de dominio, API y Worker pasan.
- `(cd ml-service && python -m pytest)` -- esperado: consumidor y generación por destino pasan.
- `(cd frontend && npm test && npm run build)` -- esperado: pruebas UI y compilación TypeScript pasan.
- `docker compose config` -- esperado: API, Worker, ML, cola, migrador y frontend componen sin conflictos.
