# Plan de pruebas de rendimiento y concurrencia

## Objetivo

Validar que la plataforma de predicción de afluencia turística pueda atender usuarios simultáneos sin degradar de forma inaceptable las consultas del dashboard ni perder estabilidad en sus servicios.

Este plan se centra en el comportamiento observable por los usuarios: consulta de demanda estimada, consulta del clima y registro diario de visitas.

## Flujos que se deben simular

| Flujo | Endpoint o acción | Importancia |
|---|---|---|
| Consultar predicción de hoy | `GET /api/v1/sites/{site_id}/predictions/{fecha}` | Alta |
| Consultar clima | `GET /api/v1/sites/{site_id}/weather/forecast?days=7` | Alta |
| Cargar dashboard | Ambas consultas anteriores desde el navegador | Alta |
| Consultar predicción de mañana | `GET /api/v1/sites/{site_id}/predictions/{fecha}` | Media |
| Registrar visitantes | `POST /api/v1/sites/{site_id}/visits` | Media; modifica datos |

> El endpoint de registro debe probarse con una base de datos o `site_id` de pruebas. Tiene una restricción de una visita por sitio y día; repetir la misma fecha debe devolver un conflicto controlado, no crear datos duplicados.

## Métricas a registrar

| Métrica | Qué indica | Resultado esperado inicial |
|---|---|---|
| Usuarios virtuales (VUs) | Cantidad de usuarios simultáneos simulados | Según el perfil de prueba |
| Peticiones por segundo (RPS) | Capacidad de atender solicitudes | Registrar el máximo sostenido |
| Tiempo promedio | Respuesta media del endpoint | Referencia, no usar sola para decidir |
| Latencia p95 | Tiempo máximo aproximado experimentado por el 95 % de usuarios | Menor de 500 ms para consultas GET |
| Latencia p99 | Casos más lentos | Registrar y analizar picos |
| Tasa de errores | Porcentaje de solicitudes HTTP fallidas | Menor de 1 % en carga normal |
| Códigos HTTP | Tipo de respuesta del sistema | `200` en GET válidos; `201`/`409` controlados en registros |
| Iteraciones completadas | Flujos de usuario terminados | Sin interrupciones inesperadas |
| Recuperación | Tiempo para volver a responder tras una prueba intensa | API disponible y sin errores persistentes |

También se debe observar que API, PostgreSQL, RabbitMQ y el microservicio ML permanezcan disponibles durante la prueba y después de ella.

## Pruebas propuestas

### 1. Smoke test

**Objetivo:** confirmar que el script de prueba, los endpoints y el entorno funcionan antes de aplicar carga relevante.

| Parámetro | Valor inicial |
|---|---|
| Usuarios simultáneos | 1 a 5 |
| Duración | 30 segundos |
| Flujos | Predicción de hoy y clima |

**Criterio de aprobación:** cero errores inesperados y respuestas correctas de los endpoints principales.

### 2. Prueba de carga normal

**Objetivo:** medir el comportamiento con una cantidad esperada de consultas simultáneas al dashboard.

| Etapa | Usuarios simultáneos | Duración sugerida |
|---|---:|---:|
| Inicio | 10 | 1 minuto |
| Carga media | 25 | 2 minutos |
| Carga esperada alta | 50 | 2 minutos |

**Criterio de aprobación:** p95 menor de 500 ms, errores menores de 1 %, sin caída de los servicios y sin crecimiento continuo de latencia.

### 3. Prueba de estrés

**Objetivo:** identificar el punto en el que el sistema comienza a degradarse o falla.

| Etapa | Usuarios simultáneos | Duración sugerida |
|---|---:|---:|
| Base | 50 | 1 minuto |
| Incremento 1 | 75 | 1 minuto |
| Incremento 2 | 100 | 1 minuto |
| Incremento 3 | 150 | 1 minuto |
| Recuperación | 0 | 2 minutos |

**Resultado a documentar:** primer nivel de concurrencia donde p95 supera el umbral, aumentan los errores o un servicio deja de responder. El objetivo no es evitar todo fallo, sino conocer y explicar el límite.

### 4. Spike test

**Objetivo:** comprobar la respuesta ante una llegada brusca de usuarios, como cuando varios comercios consultan el pronóstico al mismo tiempo.

| Etapa | Usuarios simultáneos | Duración sugerida |
|---|---:|---:|
| Estado normal | 5 | 30 segundos |
| Pico brusco | 100 | 30 segundos |
| Retorno | 5 | 1 minuto |

**Criterio de aprobación:** el sistema puede aumentar temporalmente la latencia, pero no debe quedar indisponible de forma permanente ni mantener errores después de volver a la carga normal.

### 5. Soak o prueba de resistencia

**Objetivo:** detectar degradación gradual, fugas de memoria, acumulación de conexiones o problemas que no aparecen en pruebas cortas.

| Parámetro | Valor inicial |
|---|---|
| Usuarios simultáneos | 20 a 30 |
| Duración | 30 a 60 minutos |
| Flujos | Predicción y clima, con pausas similares a uso humano |

**Criterio de aprobación:** la latencia y los errores se mantienen estables; no se presentan reinicios, indisponibilidad ni aumento progresivo de fallas.

### 6. Breakpoint test

**Objetivo:** encontrar el máximo nivel de concurrencia sostenible.

Incrementar usuarios gradualmente —por ejemplo, de 25 en 25— hasta que ocurra una de estas condiciones:

- Latencia p95 mayor de 500 ms durante una etapa completa.
- Tasa de error superior a 1 %.
- Respuestas `5xx` repetidas.
- API, base de datos o cola dejan de responder.

**Resultado a documentar:** máximo de usuarios concurrentes que cumple los umbrales definidos y comportamiento observado después del límite.

### 7. Prueba de concurrencia de escritura

**Objetivo:** verificar que los registros diarios no se duplican ni corrompen cuando existen solicitudes concurrentes.

Usar datos de prueba y enviar varios `POST /visits` para la misma fecha/sitio.

**Criterio de aprobación:** solo una solicitud crea el registro (`201 Created`); las demás reciben `409 Conflict` de forma controlada. No deben aparecer filas duplicadas ni errores `500`.

### 8. Prueba de recuperación

**Objetivo:** comprobar que la plataforma vuelve a un estado utilizable después de una prueba de estrés o pico.

1. Ejecutar una prueba de estrés o spike.
2. Detener la generación de carga.
3. Consultar predicción y clima manualmente.
4. Confirmar que los contenedores siguen activos y que las respuestas vuelven a los niveles normales.

**Criterio de aprobación:** los endpoints principales vuelven a responder correctamente y no quedan errores persistentes.

## Evidencia por cada ejecución

Registrar la siguiente tabla en el informe o presentación:

| Fecha | Prueba | VUs máximos | Duración | RPS | Promedio | p95 | p99 | Error % | Resultado |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| AAAA-MM-DD | Carga normal | 50 | 5 min | — | — | — | — | — | Aprobada / Observaciones |

Además, guardar:

- Captura o salida del resultado de la herramienta de carga.
- Captura del dashboard de monitoreo durante el pico.
- Logs de errores relevantes, si existieron.
- Conclusión: carga soportada, punto de degradación y acciones de mejora.

## Recomendación de herramienta

Usar **k6** para generar usuarios virtuales y definir escenarios progresivos. k6 permite simular carga mediante usuarios virtuales o tasa de iteraciones y definir umbrales sobre latencia y errores. [Documentación oficial de escenarios](https://grafana.com/docs/k6/latest/using-k6/scenarios/) y [guía de pruebas de API](https://grafana.com/docs/k6/latest/testing-guides/api-load-testing/).

## Alcance de la siguiente implementación

Cuando se implemente esta etapa, el repositorio debe incluir:

- Scripts de k6 versionados para smoke, carga, estrés, spike y resistencia.
- Variables de entorno para apuntar al entorno local o EC2 sin editar los scripts.
- Umbrales definidos para p95 y tasa de errores.
- Instrucciones de ejecución y formato de reporte.
- Configuración de monitoreo para correlacionar los resultados de k6 con el estado de los servicios.
