---
title: 'Ciclo diario y rediseño operativo del dashboard'
type: 'feature'
created: '2026-10-06'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context: []
baseline_commit: '8267e37'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** El dashboard muestra hoy y mañana siempre que existan filas de predicción, incluso antes del cierre de visitas. Esto confunde el ciclo operativo: la estimación de mañana debe resultar del registro real de hoy, no de un dato inicial de demostración. Además, la interfaz actual informa el clima de manera muy escueta para que comerciantes y encargados puedan tomar decisiones rápidas.

**Approach:** Aplicar una política de visibilidad por hora de Lima y por estado del registro diario; rediseñar el dashboard con jerarquía operativa, una tarjeta principal de demanda y una tabla de pronóstico meteorológico legible. La interfaz conservará el API actual, React/TypeScript y el procesamiento asíncrono API → RabbitMQ → ML → PostgreSQL.

## Boundaries & Constraints

**Always:** calcular el ciclo con `America/Lima`; entre 00:00 y 17:59 mostrar únicamente “Hoy”; desde las 18:00 habilitar el registro, pero mostrar “Mañana” solo después de que el usuario haya registrado las visitas y el API devuelva la predicción persistida; a medianoche volver a ocultar “Mañana” hasta el nuevo cierre; mantener estados de carga, espera y error explícitos; presentar el clima desde el endpoint backend de Open-Meteo; diseñar en español, responsive y accesible; conservar `mermaid-diagram.png` y `docs/.DS_Store` sin modificación.

**Never:** calcular predicciones en el navegador; mostrar valores de mañana generados por seed antes del cierre diario; llamar a Open-Meteo desde el navegador; introducir autenticación, gráficos históricos, administración del modelo o nuevos endpoints en este incremento; alterar visitas, predicciones, migraciones o el flujo RabbitMQ/ML existente.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mañana antes del cierre | Hora Lima 00:00–17:59 y fila de predicción existente | Tarjeta “Mañana” bloqueada; no solicita ni revela la predicción | Explica que estará disponible tras el registro de las 18:00 |
| Cierre abierto sin registro | Hora Lima ≥18:00, sin envío exitoso | “Mañana” sigue bloqueada; formulario habilitado | Indica que falta registrar visitas |
| Registro enviado | POST de visitas exitoso, worker aún procesando | Muestra espera de procesamiento y vuelve a consultar la predicción | No inventa resultado si el worker tarda o falla |
| Predicción persistida | Hora Lima ≥18:00 y GET de mañana responde 200 tras el registro | Muestra tarjetas “Hoy” y “Mañana” | Conserva recomendación y clima asociados |
| Cambio de día | Medianoche Lima | La predicción antes etiquetada “Mañana” se consulta/etiqueta como “Hoy”; se bloquea la nueva mañana | Recalcula el estado sin recargar manualmente |
| API o clima no disponibles | Fetch falla | Aviso de conexión y acción de reintento | No muestra cifras incompletas como válidas |

</frozen-after-approval>

## Code Map

- `frontend/src/App.tsx` -- actualmente solicita ambas fechas siempre y actualiza la apertura de registro por minuto; centralizará el ciclo diario, el refresco después de registrar y el layout de secciones.
- `frontend/src/time.ts` y `frontend/src/time.test.ts` -- ya calculan fecha/hora de Lima; ampliarlos con el estado de visibilidad para hoy, mañana y registro.
- `frontend/src/components/VisitRegistration.tsx` -- comunica éxito de POST mediante estado local; expondrá una devolución al padre para iniciar espera/consulta de mañana.
- `frontend/src/components/PredictionCard.tsx` -- presenta valores y vacío genérico; recibirá variantes de vacío guiadas por el ciclo de negocio.
- `frontend/src/components/WeatherPanel.tsx` -- ya consume pronóstico del backend; evolucionará desde tarjetas mínimas hacia tabla meteorológica, indicadores y recomendaciones de seguridad.
- `frontend/src/styles.css` -- contiene el estilo actual de una sola columna de secciones; se reemplazará por un sistema visual más jerárquico, con foco en contraste, espaciado y adaptación móvil.
- `frontend/src/App.test.tsx`, `PredictionCard.test.tsx` y nuevas pruebas de componentes/tiempo -- cubrirán la política horaria y las transiciones visibles.
- `backend/`, `ml-service/`, `db/` y `docker-compose.yml` -- no se modificarán; la interfaz mantiene los contratos existentes.

## Tasks & Acceptance

**Execution:**

- [x] `frontend/src/time.ts` y pruebas -- modelar el estado de ciclo diario de Lima: antes del cierre, formulario disponible, procesamiento y nueva jornada -- evita que una fila de seed invalide la regla de negocio.
- [x] `frontend/src/App.tsx` y pruebas -- cargar solo los datos autorizados por el ciclo, actualizar al cambiar de minuto/día y consultar mañana tras un registro exitoso -- coordina la UI sin cálculos ML en cliente.
- [x] `frontend/src/components/VisitRegistration.tsx` -- informar al contenedor cuando el API aceptó el registro y mostrar espera no engañosa -- vincula el formulario con la aparición posterior de mañana.
- [x] `frontend/src/components/PredictionCard.tsx` y pruebas -- representar estados de ausencia específicos: bloqueado hasta cierre, falta registro y procesamiento pendiente -- da instrucciones útiles al operador.
- [x] `frontend/src/components/WeatherPanel.tsx` -- construir tabla/tablero por día con fecha, condición, temperatura máxima, probabilidad y milímetros de precipitación, más aviso climático -- mejora la lectura operacional del pronóstico disponible.
- [x] `frontend/src/styles.css` -- implementar identidad visual profesional, jerarquía de encabezado, tarjetas de demanda, tabla responsive, superficies y estados de foco -- mejora comprensión en móvil y escritorio.
- [x] `frontend/src/**/*.test.*` y build -- verificar el comportamiento temporal, éxito del registro y presentación del clima -- protege el ciclo diario de regresiones.

**Acceptance Criteria:**

- Given una predicción seed de mañana existe a las 10:00 Lima, when se abre el dashboard, then no se solicita ni se muestra como “Mañana” y se explica el cierre pendiente.
- Given son las 18:00 Lima y no hay registro exitoso, when se abre el dashboard, then el formulario está activo y mañana sigue bloqueado.
- Given el API acepta el registro a las 18:00 y luego persiste la predicción, when el dashboard la consulta, then la tarjeta de mañana aparece sin recargar la página.
- Given llega medianoche Lima, when el reloj de interfaz se actualiza, then se muestra la predicción de la fecha actual como “Hoy” y se bloquea el siguiente día.
- Given el endpoint meteorológico devuelve varios días, when se renderiza el dashboard, then cada fila comunica fecha, condición, máxima, lluvia porcentual y milímetros de manera legible en móvil.
- Given un ancho de 375 px, when se visualiza la interfaz, then no existe desplazamiento horizontal y tabla/tarjetas mantienen lectura comprensible.

## Implementation Notes

La inspección de `http://18.226.25.21/` aporta como referencia útil el resumen meteorológico y las tarjetas diarias; no se replican sus controles administrativos ni su selector libre de fecha porque permiten comportamientos incompatibles con el ciclo de negocio definido.

La predicción de seed se conserva para comprobar el endpoint y la persistencia, pero no se considera autorización visual para mostrar mañana antes del registro diario.

El permiso visual de mañana se conserva por fecha en `localStorage` después de una respuesta `201 Created` del registro diario. Esto evita revelar una fila de seed al abrir o recargar la aplicación; el permiso se invalida automáticamente cuando cambia la fecha de Lima. Mientras el worker procesa RabbitMQ, el cliente consulta el endpoint de mañana cada ocho segundos hasta recibir una predicción persistida.

Se validó la interfaz con el stack Docker local: la vista de mañana permaneció bloqueada antes de las 18:00 y la tabla de Open-Meteo comunicó condición, máxima, probabilidad y milímetros de lluvia.

## Spec Change Log

## Review Triage Log

## Design Notes

La primera zona de la pantalla debe responder “¿qué debo preparar hoy?”; por ello combina una tarjeta dominante de afluencia y una recomendación. La segunda zona comunica el estado del cierre diario como una secuencia explícita: `pendiente de cierre → registrar visitas → procesando → mañana disponible`. El clima se presenta como tabla de consulta rápida, no como decoración: lluvia, milímetros y temperatura deben ser escaneables en una mirada.

## Verification

**Commands:**

- `npm test -- --run` desde `frontend/` -- expected: reglas temporales, tarjetas, registro y vistas de clima aprobadas.
- `npm run build` desde `frontend/` -- expected: compilación TypeScript y bundle Vite sin errores.
- `docker compose up -d --build frontend` -- expected: dashboard actualizado disponible en `http://localhost:3000`.
- `curl -fsS http://localhost:8080/api/v1/sites/11111111-1111-1111-1111-111111111111/weather/forecast?days=7` -- expected: contrato meteorológico consumido por la tabla.
