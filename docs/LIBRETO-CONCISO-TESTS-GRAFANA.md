# Libreto conciso: load-api, stress-api y el flujo a Grafana

Duración estimada: 3 a 4 minutos.

## 1. Apertura (15 segundos)

> “Voy a explicar cómo funcionan las dos pruebas y cómo sus métricas llegan a Grafana. La idea es que se entienda qué genera la carga, qué se mide y de dónde salen los gráficos.”

Diagrama mental para mencionar:

```text
k6  ── HTTP GET ──>  API  ──>  PostgreSQL
 │
 └── remote write ──>  Prometheus  ──>  Grafana
```

---

## 2. Cómo funciona `load-api.js` (45 segundos)

**Qué decir:**

> “`load-api.js` representa una carga normal. Primero hace el login una sola vez en `setup()` y obtiene el token, el tenant y el sitio.
>
> Después, cada usuario virtual ejecuta cuatro consultas: la sesión, la lista de sitios, el cierre del día y la predicción. Entre iteración e iteración espera un segundo, simulando el tiempo de una persona consultando el dashboard.
>
> La prueba dura cuatro minutos y sube gradualmente hasta 25 usuarios virtuales. No escribe datos: solo hace `GET`. Al final, k6 valida los umbrales y los checks funcionales.”

**Puntos clave:**

- Login una sola vez, no en cada iteración.
- 4 peticiones `GET` por vuelta.
- 25 VUs máximo, 4 minutos.
- `sleep(1)` entre iteraciones.
- Umbrales: errores < 1 %, p95 < 500 ms, p99 < 1000 ms, checks > 99 %.

---

## 3. Cómo funciona `stress-api.js` (45 segundos)

**Qué decir:**

> “`stress-api.js` usa exactamente el mismo recorrido, pero cambia la forma de aplicar la carga. En lugar de mantenerse en un nivel normal, sube por escalones: 5, 13, 25, 38 y 50 usuarios en local, con una meseta al final.
>
> El objetivo no es solo que termine, sino encontrar en qué punto el sistema empieza a degradarse. Por eso los umbrales son más tolerantes: errores < 10 %, p95 < 3000 ms y checks > 95 %.
>
> El script está preparado para llegar a 150 usuarios, que es el valor para el servidor. En local uso 50 y medio segundo de pausa para no saturar Docker Desktop.”

**Puntos clave:**

- Mismo flujo de solo lectura.
- Etapas progresivas, no carga constante.
- `STRESS_PEAK` ajusta el pico; por defecto 150.
- `STRESS_SLEEP` ajusta la pausa; en local se usa 0.5 s.
- Busca el límite, no solo el “aprobado”.

---

## 4. Cómo llegan los datos a Grafana (60 segundos)

**Qué decir:**

> “Aquí está la clave: k6 no escribe en Grafana. k6 corre en un contenedor con la salida `experimental-prometheus-rw` y envía sus muestras por *remote write* a Prometheus.
>
> Cada petición lleva etiquetas: el tipo de prueba, que puede ser `load` o `stress`, y el endpoint, por ejemplo `sites`, `closure` o `prediction`. Esas etiquetas se convierten en labels de Prometheus.
>
> Prometheus guarda las series de tiempo. Grafana se conecta a Prometheus como fuente de datos y cada cinco segundos consulta esas series con PromQL. Grafana no genera las métricas: solo las consulta y las dibuja.”

**Flujo exacto:**

1. `load-test.sh` ejecuta k6 dentro de Docker.
2. k6 hace las peticiones HTTP contra la API.
3. k6 envía las métricas a `http://prometheus:9090/api/v1/write`.
4. Prometheus almacena las series con labels como `test_type` y `endpoint`.
5. Grafana consulta Prometheus y actualiza el dashboard cada 5 segundos.

**Paneles y su consulta:**

| Panel | Qué representa | Consulta PromQL |
|---|---|---|
| Usuarios virtuales | Clientes concurrentes | `k6_vus` |
| Peticiones por segundo | Throughput | `sum(rate(k6_http_reqs_total[$__rate_interval]))` |
| Latencia p95 | 95 % de peticiones por debajo | `k6_http_req_duration_p95` |
| Errores HTTP | Tasa de respuestas fallidas | `k6_http_req_failed_rate * 100` |
| Checks correctos | Validaciones funcionales | `k6_checks_rate * 100` |
| Latencia por endpoint | Costo de cada consulta | `k6_http_req_duration_p95{test_type=~"$test_type"}` |

**Si preguntan por los otros dashboards:**

> “Las métricas de contenedores las produce Telegraf y las scrapea Prometheus. Las del host vienen de node-exporter. Los logs van de Alloy a Loki. Todo termina consultándose desde Grafana, pero el dashboard de k6 usa únicamente las métricas que empuja k6.”

---

## 5. Cierre (15 segundos)

> “Entonces, cuando ven la curva de usuarios virtuales subir y la latencia mantenerse, están viendo dos cosas en el mismo eje de tiempo: la carga que inyecta k6 y la respuesta de la API. Los umbrales dicen si la prueba pasa; Grafana muestra dónde y cuándo se degrada.”

---

## Frases de transición

- “Ahora que sabemos qué ejecuta, veamos cómo se ve en Grafana.”
- “Fíjense que el login no aparece en cada iteración: eso es intencional.”
- “La forma de la curva importa más que un número aislado.”
- “Grafana no inventa nada: si k6 no envía la muestra, no hay gráfico.”
- “Carga normal y estrés usan el mismo flujo; cambia la presión, no el recorrido.”

---

## Comandos para la demo

```bash
# Carga normal
./scripts/load-test.sh load-api.js

# Estrés local
STRESS_PEAK=50 STRESS_SLEEP=0.5 ./scripts/load-test.sh stress-api.js
```
