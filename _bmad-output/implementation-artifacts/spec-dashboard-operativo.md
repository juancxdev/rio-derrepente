---
title: 'Dashboard operativo de demanda turística'
type: 'feature'
created: '2026-10-06'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context: []
baseline_commit: '4551dcf1e8de81f75f4c1235c0d3d3fda8086792'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Los encargados de la Catarata del Río Derrepente y los comercios cercanos no tienen una vista sencilla para conocer la demanda turística estimada de hoy y mañana, ni el contexto climático que explica esa estimación.

**Approach:** Crear un dashboard web responsive que consulte el API existente y presente dos predicciones principales —hoy y mañana— junto con visitantes estimados, nivel de afluencia, puntuación, probabilidad de lluvia y temperatura máxima. Incluirá estados explícitos cuando aún no existan predicciones, en lugar de inventar resultados.

## Boundaries & Constraints

**Always:** diseñar para lectura rápida en móvil y escritorio; usar React con TypeScript y Vite; mantener el frontend como consumidor del API Go, sin acceso directo a PostgreSQL, RabbitMQ, Open-Meteo ni al microservicio ML; conservar `mermaid-diagram.png` sin modificación; mostrar claramente que la estimación se basa en `baseline-1.0`; usar una interfaz en español con accesibilidad básica, contraste alto y estados de carga/error/vacío.

**Never:** ofrecer reservas, pagos, autenticación, edición de datos, administración del modelo, datos meteorológicos de una segunda fuente, ni valores simulados cuando el API responda que no existe una predicción.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Predicciones disponibles | API devuelve resultados para hoy y mañana | Muestra dos tarjetas, clima y recomendación comercial | No aplica |
| Hoy sin predicción | API devuelve `404 prediction_not_found` | Muestra estado “aún no disponible” para hoy | Mantiene la tarjeta de mañana si existe |
| API no disponible | Error de red o respuesta no exitosa | Muestra aviso de conexión y botón “Reintentar” | No expone error técnico al usuario |
| Carga inicial | Peticiones pendientes | Muestra esqueletos de tarjetas | Evita parpadeo o valores falsos |
| Pantalla pequeña | Ancho móvil | Tarjetas en columna, contenido legible y acciones táctiles | Sin desplazamiento horizontal |

</frozen-after-approval>

## Code Map

- `backend/internal/adapters/http/api.go` -- expone `GET /api/v1/sites/:siteID/predictions/:date`; el dashboard lo consumirá sin modificar el contrato.
- `docker-compose.yml` -- orquesta API, ML, PostgreSQL y RabbitMQ; se ampliará con el servicio frontend y un puerto web público.
- `README.md` -- contiene instrucciones de ejecución; se actualizará con la URL del dashboard.
- `mermaid-diagram.png` -- archivo del usuario; debe preservarse sin cambios.
- No existe frontend actual ni endpoints agregados para hoy/mañana: el cliente calculará ambas fechas y hará dos peticiones independientes.

## Tasks & Acceptance

**Execution:**

- [x] `frontend/package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html` y `src/` -- crear aplicación React/TypeScript con Vite -- establece un cliente web independiente y compilable.
- [x] `frontend/src/api/predictions.ts` y `frontend/src/types.ts` -- implementar cliente tipado para las dos rutas de predicción, con distinción entre ausencia, error y éxito -- evita valores inventados y desacopla la UI del transporte HTTP.
- [x] `frontend/src/App.tsx` y `frontend/src/components/` -- crear encabezado del destino, resumen de hoy/mañana, tarjetas de predicción, clima, recomendación comercial y estados de interfaz -- permite tomar decisiones operativas de manera rápida.
- [x] `frontend/src/styles.css` -- crear diseño responsive, accesible y visualmente jerárquico -- asegura legibilidad a comerciantes desde móvil.
- [x] `frontend/Dockerfile`, `frontend/nginx.conf` y `docker-compose.yml` -- servir el build estático y enrutar `/api` al backend -- elimina dependencia de CORS y permite ejecutar todo con una sola composición.
- [x] `frontend/src/**/*.test.*` y configuración de pruebas -- cubrir cliente de API, tarjeta de ausencia y render de una predicción válida -- verifica los escenarios de la matriz.
- [x] `README.md` -- documentar inicio y uso del dashboard -- permite demostración reproducible.

**Acceptance Criteria:**

- Given predicciones persistidas para ambas fechas, when se abre el dashboard, then se visualizan hoy y mañana con visitantes estimados, puntuación, nivel, temperatura máxima y probabilidad de lluvia.
- Given falta la predicción de una fecha, when el API devuelve `404`, then esa tarjeta explica que la predicción aún no está disponible y no muestra cifras artificiales.
- Given el API falla, when se carga el dashboard, then se muestra un aviso entendible y el usuario puede reintentar.
- Given una pantalla de 375 px de ancho, when se renderiza el dashboard, then las tarjetas se ordenan verticalmente y no hay desplazamiento horizontal.
- Given `docker compose up --build -d`, when se abre `http://localhost:3000`, then el dashboard carga y sus solicitudes `/api` alcanzan el backend sin configurar CORS.

## Implementation Notes

- El pronóstico visible usa el endpoint Go `GET /weather/forecast`; el navegador nunca llama directamente a Open-Meteo.
- Las migraciones se ejecutan con `golang-migrate` antes de levantar API, worker y dashboard. El volumen `postgres_data` no se elimina durante un despliegue.
- Los registros de demostración son optativos e idempotentes. La columna `visit_records.source` diferencia `manual`, `official_castur` y `synthetic_demo`.
- El bloqueo de las 18:00 está en la interfaz y se calcula en `America/Lima`, conforme al alcance acordado.

## Spec Change Log

## Review Triage Log

## Design Notes

La pantalla debe priorizar la pregunta “¿cuántos posibles consumidores habrá?”. La primera fila mostrará dos tarjetas grandes: Hoy y Mañana. Cada una mostrará el estimado y un indicador visual de afluencia; debajo mostrará el clima que contribuye al resultado. Una recomendación corta traduce la predicción para un comerciante, por ejemplo: “Prepara stock moderado; existe alta probabilidad de lluvia”.

La fecha se calculará en zona horaria `America/Lima`. El frontend no realizará pronósticos, no aplicará factores y no tendrá datos duplicados: solo representa el resultado persistido que entrega el backend.

## Verification

**Commands:**

- `npm run test` desde `frontend/` -- expected: escenarios de interfaz y API exitosos.
- `npm run build` desde `frontend/` -- expected: compilación TypeScript y build Vite exitosos.
- `docker compose up --build -d` -- expected: frontend y dependencias saludables.
- `curl -fsS http://localhost:3000` -- expected: HTML del dashboard.
- `docker compose --profile tools run --rm migrate` -- passed: versiones 1 y 2 limpias en `schema_migrations`.
- `docker compose run --rm ml-service python -m pytest` -- passed: 2 pruebas.
- `curl -fsS http://localhost:8080/api/v1/sites/.../weather/forecast?days=2` -- passed: respuesta de Open-Meteo a través del API.
