---
title: 'Rediseño operativo y contexto climático de la predicción'
type: 'feature'
created: '2026-10-06'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
context: []
baseline_commit: 'e9786fe6aac9d60817ff28ee369e40862595695e'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** El dashboard actual presenta un pronóstico operativo útil en su tabla inferior, pero la tarjeta principal de Hoy puede mostrar datos climáticos pendientes aunque esos datos ya están disponibles en pantalla. La jerarquía visual también requiere una evolución para que encargados y comercios identifiquen primero la demanda, el clima que la contextualiza y el siguiente paso de operación.

**Approach:** Rediseñar el frontend React existente como una consola clara y sobria, manteniendo la arquitectura y el ciclo diario. Reutilizar el pronóstico servido por el backend para completar solo los campos climáticos faltantes de las tarjetas de predicción y mejorar la lectura de la tabla climática sin copiar la interfaz del sandbox externo.

## Boundaries & Constraints

**Always:** conservar los endpoints y el flujo API Go → datos persistidos; calcular el ciclo con `America/Lima`; obtener el clima visible exclusivamente desde `GET /weather/forecast` a través del backend; diferenciar una predicción no disponible de un dato meteorológico disponible; preservar el bloqueo de Mañana hasta el registro diario; usar español, foco visible, estados de carga/error/vacío, contraste alto y adaptación móvil; mantener intactos `docs/sandbox-externo/`, archivos `.DS_Store` y `mermaid-diagram.png`.

**Never:** llamar a Open-Meteo desde el navegador; modificar backend, ML, migraciones, RabbitMQ o datos; sustituir una predicción ausente por una calculada en cliente; copiar archivos, estilos o controles administrativos del sandbox de referencia; cambiar nombres de campos ni el orden del formulario de visitas.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Predicción con clima persistido | API de predicción incluye temperatura y lluvia | La tarjeta muestra sus propios datos climáticos | No aplica |
| Predicción sin clima persistido | Campos meteorológicos nulos y pronóstico contiene la misma fecha | La tarjeta muestra máxima, condición, probabilidad y milímetros del pronóstico ya cargado | No altera la predicción ni crea valores |
| Fecha sin coincidencia meteorológica | No existe día de pronóstico para la fecha de predicción | La tarjeta explica que el contexto climático no está disponible | No muestra guiones ambiguos ni cifras simuladas |
| Pronóstico no disponible | La llamada al endpoint de clima falla | La predicción continúa visible con estado climático explícito | Se conserva el aviso de conexión y reintento |
| Vista móvil | Ancho de 375 px | Demanda, clima y cierre se apilan sin desplazamiento horizontal | Tabla conserva lectura mediante estructura responsive |

</frozen-after-approval>

## Code Map

- `frontend/src/App.tsx` -- carga predicciones y el pronóstico, controla el ciclo diario y compone las secciones; añadirá la asociación por fecha sin modificar el transporte.
- `frontend/src/types.ts` -- define los contratos de `Prediction` y `WeatherForecast`; puede extender solo el modelo de presentación con campos ya existentes en el pronóstico.
- `frontend/src/components/PredictionCard.tsx` -- hoy usa emojis y muestra `Pendiente`; se convertirá en la tarjeta operativa principal con clima contextual explícito y estados accesibles.
- `frontend/src/components/WeatherPanel.tsx` -- contiene la tabla y el resumen del pronóstico; conservará su información y mejorará el escaneo visual, sin controles de administración del sandbox.
- `frontend/src/styles.css` -- concentra los tokens y estilos de toda la vista; se reemplazará por un sistema de superficies, tipografía, espaciado y breakpoints consistente.
- `frontend/src/App.test.tsx` y `frontend/src/components/PredictionCard.test.tsx` -- prueban ciclo diario y tarjeta; se ampliarán para cubrir el respaldo desde el pronóstico y la ausencia de coincidencia.
- `docs/sandbox-externo/afluencia-derrepente/frontend/` -- referencia local no rastreada; solo aporta ideas de jerarquía de clima, no debe editarse ni importarse.

## Tasks & Acceptance

**Execution:**

- [x] `frontend/src/App.tsx` y un helper de presentación tipado -- asociar una predicción con el día de pronóstico de igual fecha, dando precedencia a valores ya persistidos -- elimina campos vacíos sin alterar el contrato del API.
- [x] `frontend/src/types.ts` y `frontend/src/components/PredictionCard.tsx` -- exponer contexto climático completo, condición legible y estado claro cuando no exista pronóstico -- convierte la tarjeta en una explicación comprensible de la estimación.
- [x] `frontend/src/components/WeatherPanel.tsx` y `frontend/src/styles.css` -- rediseñar jerarquía, resumen meteorológico, tabla y formulario dentro de una identidad operacional verde consistente -- mejora escaneo en escritorio y móvil con accesibilidad.
- [x] `frontend/src/App.test.tsx`, pruebas de componente y pruebas del helper -- verificar prioridad de datos persistidos, respaldo por fecha, ausencia de pronóstico y ciclo de Mañana -- evita regresiones de datos falsos o de horario.
- [x] `frontend/` -- ejecutar pruebas, compilación y la composición Docker; revisar manualmente en escritorio y a 375 px -- valida la interfaz entregable.

**Acceptance Criteria:**

- Given una predicción de Hoy sin `temperature_max` ni `precipitation_probability`, when el pronóstico backend devuelve el día de Hoy, then la tarjeta comunica condición, temperatura, probabilidad y milímetros reales del pronóstico.
- Given una predicción ya contiene un valor climático, when existe otro valor en el pronóstico, then la tarjeta conserva el valor persistido de la predicción.
- Given no hay día de pronóstico coincidente, when se muestra la tarjeta, then el usuario ve una explicación explícita y no ve guiones ni valores calculados.
- Given se carga el dashboard antes del cierre, when existe una fila seed para Mañana, then la tarjeta de Mañana continúa bloqueada y no se solicita su predicción.
- Given un operador usa la vista móvil, when inspecciona demanda, clima y registro, then puede leer y operar sin desplazamiento horizontal ni controles ambiguos.

## Implementation Notes

La referencia externa inspira una lectura más estructurada de clima, especialmente al combinar condición, temperatura y lluvia. El rediseño mantendrá el contrato, el ciclo diario y la identidad propia de esta plataforma.

La asociación meteorológica vive en `frontend/src/weatherPresentation.ts`: normaliza la fecha de la predicción y completa únicamente campos ausentes. Los datos persistidos conservan prioridad. No se añadieron dependencias ni peticiones externas desde el navegador.

## Spec Change Log

## Review Triage Log

## Design Notes

La superficie principal prioriza el estimado de consumidores y sitúa el clima como evidencia de contexto, no como una segunda predicción. La paleta permanece verde bosque con un único acento de interfaz, superficies claras y bordes de bajo contraste. Se evita decoración, animación continua y emojis estructurales. Los estados de carga preservan la geometría de la tarjeta para evitar saltos visuales.

## Verification

**Commands:**

- `npm test -- --run` desde `frontend/` -- expected: reglas temporales, asociación meteorológica y componentes aprobados.
- `npm run build` desde `frontend/` -- expected: TypeScript y Vite compilan sin errores.
- `docker compose up -d --build frontend` -- expected: dashboard actualizado disponible en `http://localhost:3000`.
- `curl -fsS http://localhost:3000` -- expected: respuesta HTML del frontend.
