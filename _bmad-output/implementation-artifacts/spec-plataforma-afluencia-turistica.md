---
title: 'Plataforma backend de predicción de afluencia turística'
type: 'feature'
created: '2026-10-01'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No existe una plataforma ejecutable para registrar la afluencia diaria de la Catarata del Río Derrepente, relacionarla con datos climáticos y exponer una predicción que no dependa de ejecutar trabajo de ML durante una consulta pública.

**Approach:** Crear desde cero un backend con Go/Fiber y arquitectura hexagonal orientada a dominio, más un servicio ML Python independiente. El backend persistirá registros y publicará trabajos asíncronos; el servicio ML generará y almacenará predicciones para que el backend las entregue desde PostgreSQL.

## Boundaries & Constraints

**Always:** aplicar separación por capas de dominio, aplicación, puertos y adaptadores; respetar SOLID; usar Fiber para la API Go y FastAPI para ML; registrar logs estructurados; usar PostgreSQL, RabbitMQ y Docker Compose; tratar los datos de 2024 como una línea base mensual y no como visitas diarias; persistir predicciones antes de exponerlas; devolver errores HTTP consistentes; incluir pruebas automatizadas para reglas de dominio, API y cálculo inicial.

**Never:** ejecutar XGBoost o entrenamiento durante una consulta `GET`; perder un registro de visita por una caída del worker ML; exponer PostgreSQL o RabbitMQ como API pública; fabricar datos diarios a partir del histórico mensual 2024; desplegar ni crear recursos de AWS en esta entrega; incluir un frontend, autenticación, pagos, reservas o modelos neuronales.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Registro válido | Fecha, conteos no negativos y sitio existente | Guarda visita, consulta/guarda clima y publica trabajo | `201 Created`; el procesamiento continúa asíncrono |
| Registro repetido | Ya existe `site_id + visit_date` | No duplica información | `409 Conflict` con error estructurado |
| Conteos inválidos | Negativos o total inconsistente | No persiste ni publica evento | `422 Unprocessable Entity` |
| ML temporalmente caído | RabbitMQ retiene el trabajo | La API mantiene el registro aceptado | Reintento y cola de mensajes fallidos |
| Consulta de predicción existente | Predicción guardada para fecha/sitio | Devuelve visitantes estimados, puntuación, nivel y clima | `200 OK` |
| Consulta sin predicción | No hay resultado persistido | No inicia ML en línea | `404 Not Found` con código `prediction_not_found` |

</frozen-after-approval>

## Code Map

- Repositorio inicial vacío; se creará la estructura de servicios, pruebas y orquestación sin reutilizar código existente.
- `backend/` -- API Go/Fiber, núcleo DDD/hexagonal, adaptadores PostgreSQL, RabbitMQ y Open-Meteo.
- `ml-service/` -- FastAPI, cálculo base, contratos de entrada/salida, persistencia de predicciones y preparación para XGBoost.
- `docker-compose.yml` -- orquestación local de la plataforma.
- `db/migrations/` -- esquema PostgreSQL versionado.
- `docs/` -- guía de ejecución, arquitectura y contratos operativos.

## Tasks & Acceptance

**Execution:**

- [x] `backend/go.mod`, `backend/cmd/api/main.go` y `backend/internal/` -- crear API Fiber y capas dominio/aplicación/puertos/adaptadores -- establece el servicio principal hexagonal.
- [x] `backend/internal/domain/visits` -- implementar entidad, validaciones y puertos de repositorio/publicación -- concentra las reglas de visitantes sin dependencias de infraestructura.
- [x] `backend/internal/application/` -- implementar casos de uso de registrar visita y consultar predicción -- coordina el dominio y dependencias mediante interfaces.
- [x] `backend/internal/adapters/http`, `postgres`, `rabbitmq`, `weather` y `logging` -- implementar entradas/salidas concretas, middleware de recuperación, correlación y logs JSON -- conecta Fiber con infraestructura sin contaminar el dominio.
- [x] `db/migrations/001_initial.sql` -- crear sitios, visitas, clima, predicciones y trabajos con índices/restricciones -- garantiza persistencia e idempotencia.
- [x] `ml-service/app/` -- crear FastAPI modular, servicio de cálculo base, acceso PostgreSQL, worker RabbitMQ y endpoint de salud -- desacopla el procesamiento de predicción.
- [x] `ml-service/app/domain` y `tests/` -- calcular estimación, puntuación limitada a 0–100 y nivel -- entrega una predicción usable antes de contar con datos para XGBoost.
- [x] `docker-compose.yml`, `backend/Dockerfile`, `ml-service/Dockerfile`, `.env.example` y `README.md` -- ejecutar todos los servicios con configuración no secreta de ejemplo -- permite demostrar el sistema localmente y prepararlo para EC2.
- [x] `backend/**/_test.go`, `ml-service/tests/` y scripts de verificación -- cubrir matriz de I/O, compilar y ejecutar pruebas -- evita regresiones en reglas críticas.

**Acceptance Criteria:**

- Given el entorno Docker levantado, when se llama a los health checks, then API y servicio ML responden con estado saludable y logs JSON.
- Given un registro de visita válido, when se invoca el endpoint de creación, then PostgreSQL contiene el registro y RabbitMQ recibe un evento persistente sin esperar al worker.
- Given el mismo sitio y fecha ya registrados, when se repite la solicitud, then el API devuelve `409` y no crea una segunda fila.
- Given un trabajo encolado, when el worker completa el cálculo, then existe una predicción persistida del día siguiente con puntuación entre 0 y 100.
- Given una predicción persistida, when se consulta por HTTP, then el backend la devuelve sin llamar síncronamente al servicio ML.
- Given el worker ML no está disponible, when se registra una visita, then el backend conserva el dato y responde exitosamente sin perder el mensaje.

## Implementation Notes

- Se creó una plataforma ejecutable desde un repositorio vacío. El backend Go mantiene el dominio aislado de Fiber, PostgreSQL y RabbitMQ mediante puertos de aplicación.
- Se añadió `baseline-1.0` en Python: genera una predicción persistida con puntuación limitada a 0–100; la versión futura de XGBoost conserva el contrato de salida.
- RabbitMQ usa una cola durable y publicaciones persistentes. El worker Python procesa los eventos de forma asíncrona y PostgreSQL evita duplicar predicciones de la misma versión.
- Se validaron las pruebas Go, `go vet`, las pruebas Python y la sintaxis de Docker Compose. No se pudo construir o iniciar contenedores porque el daemon Docker no está activo en el equipo.

## Spec Change Log

## Review Triage Log

## Design Notes

La primera versión del ML será una estrategia base explícita: promedio histórico mensual disponible multiplicado por factores de clima, feriado, fin de semana y temporada. El contrato del servicio mantendrá una `model_version`, para que XGBoost Regressor sustituya la implementación posteriormente sin cambiar la API pública.

El backend mantiene la propiedad de los registros de negocio; el servicio ML solo consulta datos necesarios y persiste resultados/versiones de modelo mediante un puerto propio. Los mensajes contendrán identificadores, no el registro completo, y el consumidor será idempotente.

## Verification

**Commands:**

- `docker compose up --build -d` -- expected: PostgreSQL, RabbitMQ, API y ML ejecutándose.
- `go test ./...` desde `backend/` -- expected: pruebas de dominio, aplicación y HTTP exitosas.
- `pytest` desde `ml-service/` -- expected: pruebas de puntuación y cálculo base exitosas.
- `docker compose exec api go vet ./...` -- expected: análisis Go sin errores.
