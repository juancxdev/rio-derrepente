# Libreto: demostración de carga y estrés

Guion para exponer únicamente las pruebas `load-api.js` y `stress-api.js`, explicando los gráficos de Grafana.

> Recomendación de orden: **primero carga, después estrés**. Así la audiencia entiende primero el comportamiento normal y luego el límite. Si quieres usar el orden inverso, intercambia los bloques 2 y 3; las explicaciones siguen siendo válidas.

## Antes de empezar

Deja preparadas tres pestañas o ventanas:

1. **Grafana · Pruebas k6**
   `http://127.0.0.1:13000/d/afluencia-k6`
   - Rango de tiempo: **Last 15 minutes**
   - Filtro **Tipo de prueba**: `All`
   - Refresco: `5s`

2. **Grafana · Contenedores y host**
   `http://127.0.0.1:13000/d/afluencia-overview`

3. **Terminal** en la raíz del proyecto:
   ```bash
   cd /Users/juancx/Documents/CX-Developments/SELF/Proyecto-aplicaciones-para-la-nube
   ```

Comprueba que no haya otra prueba corriendo. No ejecutes carga y estrés al mismo tiempo.

Si quieres una comprobación rápida antes de la exposición:

```bash
./scripts/load-test.sh smoke-api.js
```

Debe dar `11 de 11 checks` y `0 %` de errores. Si falla el login, ejecuta:

```bash
./scripts/loadtest-setup.py
```

---

## 1. Apertura (30–45 segundos)

**Qué mostrar:** el dashboard de Grafana y la terminal, todavía sin ejecutar nada.

**Qué decir:**

> “En esta parte voy a mostrar dos pruebas sobre el flujo de lectura del dashboard: una de carga normal y otra de estrés progresivo.
>
> Las dos usan un usuario de solo lectura y ejecutan el mismo recorrido: consultar la sesión, listar los sitios, consultar el cierre del día y consultar la predicción. No crean tickets, visitas ni cierres; solo leen.
>
> k6 genera la carga, la API responde y las métricas viajan a Prometheus. Grafana es la vista que tenemos aquí. El objetivo no es solo ver si la prueba termina, sino entender cómo se comportan la latencia, los errores y los recursos cuando aumenta la concurrencia.”

**Señala en pantalla:**

- Arriba: usuarios virtuales, peticiones por segundo, latencia p95 y errores.
- Abajo: latencia por endpoint, throughput, evolución de VUs y checks.

---

## 2. Prueba de carga normal

### Comando

```bash
./scripts/load-test.sh load-api.js
```

### Antes de que empiece

**Qué decir:**

> “Esta prueba representa una carga normal. Durante cuatro minutos sube gradualmente hasta 25 usuarios virtuales, se mantiene ahí y luego baja.
>
> Cada usuario virtual ejecuta el recorrido completo y espera un segundo entre iteraciones, simulando el tiempo que una persona tarda en consultar el dashboard. El login se hace una sola vez al inicio, no en cada vuelta, para no medir el costo de bcrypt en cada petición.”

### Cronología para narrar

| Momento | Qué ocurre | Qué decir |
|---|---|---|
| `0:00` | Arranca k6 y hace el login inicial | “Arranca la prueba; primero autentica y valida que haya una predicción disponible.” |
| `0:30` | Sube a 5 VUs | “Empieza el ramp-up. Todavía es una carga muy baja.” |
| `1:30` | Sube a 10 VUs | “La concurrencia se duplica; observen que la latencia debe mantenerse estable.” |
| `3:30` | Llega a 25 VUs | “Este es el pico de carga normal: 25 usuarios concurrentes.” |
| `3:30–4:00` | Baja a 0 | “La prueba empieza a cerrar; k6 espera a que terminen las iteraciones en curso.” |
| `4:00` | Resumen final | “Lean el resumen: checks, errores, p95, throughput e iteraciones.” |

### Qué explicar en cada gráfico

#### Usuarios virtuales

> “Cada VU es un cliente simulado que ejecuta el flujo completo. No son hilos del servidor. La curva debe subir hasta 25, mantenerse plana y bajar. Si la latencia sube justo cuando suben los VUs, ahí empieza a aparecer la contención.”

#### Peticiones por segundo

> “Es el throughput real. Con 25 VUs y una pausa de un segundo, esperamos alrededor de 45 a 50 peticiones por segundo. Si al aumentar los VUs el throughput se estanca y la latencia sube, el sistema está saturándose.”

#### Latencia p95

> “El p95 significa que el 95 % de las peticiones terminó por debajo de ese tiempo. Es más representativo que el promedio, porque el promedio puede esconder una cola de peticiones lentas. En carga normal esperamos pocos milisegundos y una curva estable.”

#### Errores HTTP

> “Mide respuestas no esperadas: errores 4xx, 5xx o timeouts. En esta prueba queremos ver 0 %. Si aparece un error, hay que revisar si es un problema de la API, de la base de datos o del propio fixture.”

#### Checks correctos

> “Los checks no son solo el código HTTP. Validan que la respuesta tenga la estructura esperada: que la lista de sitios no esté vacía, que el cierre tenga estado y fecha, y que la predicción tenga visitantes y nivel. Un 200 con un JSON incorrecto haría fallar un check.”

#### Latencia p95 por endpoint

> “Esta gráfica separa el costo por endpoint. Aquí se ve si el cuello de botella está en la lista de sitios, el cierre o la predicción. En esta prueba los tres son consultas a PostgreSQL y deberían moverse en el mismo orden de magnitud.”

### Cierre de la prueba de carga

**Qué decir al terminar:**

> “La carga normal termina con cero errores y los checks al 100 %. La latencia p95 se mantiene en pocos milisegundos y el throughput sube con los usuarios virtuales. Esto nos da una línea base: el flujo de lectura está sano antes de exigirlo más.”

**Valores de referencia de esta máquina:**

- 11,642 peticiones HTTP
- 2,910 iteraciones
- 48.4 peticiones por segundo
- p95: 4 ms
- promedio: 1.97 ms
- máximo: 65.93 ms
- 0 errores
- 32,010 checks, 100 % correctos

> Aclara que estos números son de tu entorno local; en el servidor cambiarán. Lo importante es la forma de las curvas y la comparación entre carga y estrés.

---

## 3. Prueba de estrés

### Comando

Para la exposición local:

```bash
STRESS_PEAK=50 STRESS_SLEEP=0.5 ./scripts/load-test.sh stress-api.js
```

Si quieres mostrar el máximo configurado para el servidor:

```bash
./scripts/load-test.sh stress-api.js
```

### Antes de que empiece

**Qué decir:**

> “Ahora subimos la exigencia. El script está preparado para llegar hasta 150 usuarios virtuales, que es el valor que usaríamos contra el servidor. En local voy a usar 50 y una pausa de medio segundo para no saturar Docker Desktop.
>
> La diferencia con la carga normal no es solo el número de usuarios: el estrés es progresivo y busca el punto donde el sistema empieza a degradarse. Por eso los umbrales son más tolerantes; un fallo de umbral aquí es un hallazgo para analizar, no necesariamente un error del script.”

### Cronología para narrar

| Momento | Qué ocurre | Qué decir |
|---|---|---|
| `0:00` | Arranca y autentica | “Mismo flujo, misma autenticación, ahora con más concurrencia.” |
| `0:30` | 5 VUs | “Primer escalón.” |
| `1:00` | 13 VUs | “Seguimos subiendo.” |
| `1:30` | 25 VUs | “Ya estamos en el nivel de la prueba de carga anterior.” |
| `2:00` | 38 VUs | “Empezamos a superar la carga normal.” |
| `3:00` | 50 VUs | “Este es el pico local. Observen latencia, errores y CPU.” |
| `4:00` | Se mantiene en 50 | “Meseta: aquí se ve si el sistema sostiene la carga o empieza a degradarse.” |
| `4:30` | Baja a 0 | “Cierre y resumen.” |

### Qué explicar en cada gráfico

#### Usuarios virtuales

> “La curva debe verse como una escalera: 5, 13, 25, 38, 50 y luego la meseta. Esa forma es intencional: nos permite ver en qué escalón cambia el comportamiento.”

#### Peticiones por segundo

> “Con 50 VUs y medio segundo de pausa esperamos alrededor de 230 peticiones por segundo. Si el throughput deja de subir mientras los VUs siguen altos, encontramos el límite de procesamiento.”

#### Latencia p95 y p99

> “En estrés la latencia puede subir, pero debe hacerlo de forma controlada. Si el p95 se dispara, miramos si el p99 lo acompaña: eso indica una cola de peticiones lentas. Si además el throughput se estanca, el sistema está saturado.”

#### Errores HTTP

> “Aquí no buscamos necesariamente 0 % como en carga normal; buscamos que los errores no se disparen. Un aumento pequeño puede ser aceptable en un entorno de prueba, pero un salto grande indica que el sistema dejó de responder o que la base de datos se quedó sin conexiones.”

#### Checks correctos

> “Aunque el HTTP responda, los checks confirman que la respuesta sigue siendo funcional. Si los checks bajan mientras los errores HTTP no suben, el problema está en el contenido de la respuesta, no en la red.”

#### Contenedores y host

> “Esta es la parte de correlación. Si la latencia sube, miramos CPU y memoria de `api` y `postgres`. Si la CPU está al 100 % o la memoria se acerca al límite, ya tenemos una explicación del comportamiento. También verificamos que no haya reinicios.”

### Cierre de la prueba de estrés

**Qué decir al terminar:**

> “Con 50 usuarios virtuales el sistema sostuvo la carga: cero errores, checks al 100 % y un p95 cercano a 10 milisegundos. Eso no significa que 150 usuarios vayan a comportarse igual; significa que la aplicación tiene margen y que el monitoreo nos permite ver dónde aparecería el límite.
>
> El siguiente paso sería ejecutar la misma prueba contra el servidor con 150 VUs, en una ventana de mantenimiento y sin el endpoint de clima, para medir la capacidad real.”

**Valores de referencia de esta máquina:**

- 63,646 peticiones HTTP
- 15,911 iteraciones
- 235.5 peticiones por segundo
- p95: 9.94 ms
- promedio: 3.53 ms
- máximo: 87.79 ms
- 0 errores
- 175,021 checks, 100 % correctos
- 50 VUs máximos

---

## 4. Cierre de la exposición (30 segundos)

**Qué decir:**

> “En resumen: la prueba de carga muestra que el flujo de lectura responde con latencia baja y sin errores en condiciones normales. La prueba de estrés muestra cuánto margen tiene el sistema antes de degradarse y qué señales debemos mirar: p95, throughput, errores y recursos.
>
> Las dos pruebas son de solo lectura y están parametrizadas por variables de entorno, así que el mismo código se puede apuntar al servidor cambiando `K6_API_BASE_URL` y ajustando `STRESS_PEAK`. El monitoreo queda como evidencia objetiva, no solo como una impresión visual.”

---

## 5. Chuleta de gráficos

| Panel | Qué muestra | Carga normal | Estrés local | Cómo explicarlo |
|---|---|---|---|---|
| Usuarios virtuales | Clientes concurrentes | Hasta 25 | Hasta 50 | Es la presión que estamos aplicando |
| Peticiones por segundo | Throughput | ~48 req/s | ~235 req/s | Si se estanca con más VUs, hay saturación |
| Latencia p95 | 95 % de peticiones por debajo | ~4 ms | ~10 ms | Más útil que el promedio para ver colas |
| Errores HTTP | Fallos de respuesta | 0 % | 0 % | Debe mantenerse bajo; un salto indica degradación |
| Checks correctos | Validaciones funcionales | 100 % | 100 % | Confirma que el contenido sigue siendo correcto |
| Latencia por endpoint | Costo de cada consulta | Bajo y estable | Bajo y estable | Permite ubicar el cuello de botella |
| Contenedores | CPU, memoria, red | Moderado | Sube con la carga | Correlaciona latencia con recursos |

---

## 6. Preguntas probables

**¿Qué es un VU?**
> “Un usuario virtual: un cliente simulado por k6 que ejecuta el flujo de forma independiente. No es un usuario real ni un hilo del servidor.”

**¿Por qué el login se hace una sola vez?**
> “Porque bcrypt es costoso y queremos medir el flujo de lectura del dashboard. Si hiciéramos login en cada iteración, la prueba mediría principalmente el costo de autenticación.”

**¿Por qué no se prueba el clima?**
> “Porque depende de Open-Meteo, un servicio externo. Incluirlo mezclaría la latencia de un tercero con la capacidad de nuestra plataforma. Está disponible con `INCLUDE_WEATHER=true`, pero no se recomienda en estrés.”

**¿Por qué 50 VUs en local y 150 en el servidor?**
> “Docker Desktop en una laptop no representa los recursos del servidor. 50 VUs alcanzan para demostrar el comportamiento y el monitoreo local; 150 es el valor configurado para la prueba real en el servidor.”

**¿Por qué p95 y no el promedio?**
> “Porque el promedio puede ocultar una cola de usuarios que esperan mucho. El p95 nos dice cómo vive el 95 % de las peticiones y el p99 nos muestra la cola más extrema.”

**¿Qué pasa si hay errores?**
> “Primero se identifica el endpoint y el tipo de error. Luego se correlaciona con CPU, memoria, conexiones a PostgreSQL y logs. En estrés, un fallo de umbral es un resultado a analizar, no un fallo de la demostración.”

**¿Estas pruebas escriben datos?**
> “No. Solo hacen `GET` sobre sesión, sitios, cierres y predicciones. El fixture se crea aparte con `loadtest-setup.py`; las pruebas de carga no crean tickets ni visitas.”

**¿Cuál es la diferencia entre carga y estrés?**
> “La carga busca demostrar que el sistema funciona bien con una concurrencia esperada. El estrés busca encontrar el punto donde deja de hacerlo.”

**¿Por qué los números son tan buenos?**
> “Porque es un entorno local con un conjunto de datos pequeño y un solo sitio. La prueba sirve como línea base y para validar el monitoreo; la capacidad real se mide en el servidor con sus datos y recursos.”

---

## 7. Si algo sale mal durante la presentación

- **No aparecen datos en Grafana:** espera 5–10 segundos, revisa que el rango sea “Last 15 minutes” y que el filtro sea `All`.
- **El panel superior muestra 0 después de terminar:** es normal en algunos paneles de tipo stat; usa las gráficas de series temporales y el resumen de k6.
- **Falla el login:** ejecuta `./scripts/loadtest-setup.py` y vuelve a lanzar la prueba.
- **No hay predicción:** vuelve a ejecutar el setup con el servicio ML disponible.
- **El estrés satura la laptop:** detén con `Ctrl+C` y repite con `STRESS_PEAK=25` o `STRESS_SLEEP=1`.
- **Quieres aislar una prueba:** selecciona `load` o `stress` en el filtro **Tipo de prueba**.

---

## 8. Comandos, en orden

```bash
# 1. Carga normal
./scripts/load-test.sh load-api.js

# 2. Estrés local
STRESS_PEAK=50 STRESS_SLEEP=0.5 ./scripts/load-test.sh stress-api.js
```

Si prefieres el orden inverso:

```bash
STRESS_PEAK=50 STRESS_SLEEP=0.5 ./scripts/load-test.sh stress-api.js
./scripts/load-test.sh load-api.js
```
