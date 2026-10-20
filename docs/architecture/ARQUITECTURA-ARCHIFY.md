# Arquitectura de la plataforma Río Derrepente

Este documento acompaña al diagrama interactivo generado con Archify:

- [Abrir diagrama de arquitectura](./01-arquitectura-general.html)
- [Abrir diagrama detallado de despliegue VPS](./02-despliegue-vps-coolify.html)
- [Abrir fuente Mermaid con boundaries anidados](./02-despliegue-vps-coolify-boundaries.mmd)
- Archivo fuente: [`01-arquitectura-general.architecture.json`](./01-arquitectura-general.architecture.json)
- Fuente del despliegue detallado: [`02-despliegue-vps-coolify.architecture.json`](./02-despliegue-vps-coolify.architecture.json)

El diagrama está pensado para una revisión técnica y también para una exposición. Las etiquetas están redactadas en español; la interfaz del visor de Archify puede aparecer en inglés según la versión instalada.

## Qué representa el diagrama

La arquitectura se organiza en tres vistas guiadas:

1. **Lectura operativa:** muestra cómo los encargados y comerciantes consultan el dashboard, cómo el frontend llama al API y cómo el API devuelve datos persistidos.
2. **Cierre y predicción asíncrona:** muestra la venta presencial de tickets, el cierre diario ejecutado por el Worker, el evento publicado en RabbitMQ, el procesamiento ML y el guardado de la predicción.
3. **Despliegue:** muestra el flujo `push a main → GitHub Actions → SSH a EC2 → actualización y migraciones`.

## Componentes principales

| Componente | Responsabilidad |
|---|---|
| Dashboard React | Presenta ventas, clima, afluencia y predicciones. Consume únicamente el API público del backend. |
| API Go/Fiber | Gestiona tenants, destinos, venta presencial de tickets, importación histórica y consultas de predicción. |
| PostgreSQL | Mantiene tenants, sitios, tickets, históricos diarios, clima, predicciones y metadatos de entrenamiento. Usa migraciones versionadas y volumen persistente. |
| Worker Go | Ejecuta el cierre diario por destino, consolida tickets vendidos, consulta el clima y solicita el reentrenamiento. |
| RabbitMQ | Desacopla el cierre diario del cálculo ML. Permite reintentos y evita que una caída del modelo afecte al API. |
| Microservicio ML | Consume eventos diarios, reentrena XGBoost Regressor y guarda el pronóstico del día siguiente. |
| Open-Meteo | API externa de clima consumida por el Worker durante el cierre diario. |
| GitHub Actions | Ejecuta el pipeline de despliegue cuando se actualiza `main`. |
| Amazon EC2 | Ejecuta Docker Compose con frontend, API, PostgreSQL, RabbitMQ y ML. |

## Flujo 1: consulta del dashboard

1. Un encargado abre el dashboard publicado en el puerto `3000`.
2. El frontend solicita al API el resumen, el pronóstico de afluencia y el pronóstico meteorológico.
3. El API consulta PostgreSQL para obtener los datos ya calculados.
4. El API consulta Open-Meteo cuando necesita actualizar o mostrar el clima.
5. El frontend presenta la información sin ejecutar el modelo ML.

La predicción no se recalcula en cada consulta. Esto mantiene la respuesta rápida y evita consumir recursos innecesariamente.

## Flujo 2: venta, cierre y predicción diaria

1. El encargado vende presencialmente uno o más tickets al visitante.
2. El API persiste cada ticket como una visita real del día y actualiza los indicadores.
3. Al cierre del día, el Worker consolida los tickets vendidos por destino.
4. El Worker consulta Open-Meteo y guarda los datos climáticos junto con el histórico diario.
5. El Worker publica `daily-closure` en RabbitMQ.
6. El microservicio ML consume el evento, reentrena XGBoost y genera la predicción del día siguiente.
7. La predicción queda almacenada en PostgreSQL y el dashboard solo lee ese resultado persistido.

El cierre se ejecuta por la zona horaria configurada para cada destino; no depende de que un encargado registre manualmente el total de visitantes.

## Flujo 3: despliegue y persistencia

1. Un cambio llega a la rama `main`.
2. GitHub Actions se conecta por SSH a EC2.
3. El servidor ejecuta `git pull --ff-only origin main`.
4. `scripts/deploy.sh` ejecuta las migraciones pendientes con `golang-migrate`.
5. Docker Compose reconstruye o actualiza los servicios.
6. PostgreSQL conserva los registros mediante el volumen Docker `postgres_data`.

Las migraciones son incrementales: una migración aplicada queda registrada por `golang-migrate` y no se vuelve a ejecutar. Los datos de visitantes no deben guardarse dentro de la imagen ni en un directorio efímero del contenedor.

## Red y seguridad de EC2

El diagrama distingue la región AWS `us-east-2` y el Security Group de la instancia. Para una exposición inicial se consideran:

- `22/TCP`: SSH usado por GitHub Actions; idealmente restringido a las IPs necesarias.
- `3000/TCP`: dashboard público durante la demostración.
- PostgreSQL, RabbitMQ, ML y API interno: accesibles únicamente dentro de la red Docker/EC2; no se publican directamente a Internet.

La IP pública de una instancia sin Elastic IP puede cambiar después de detenerla y volverla a iniciar. Por eso el despliegue debe actualizar el secreto `EC2_HOST` cuando cambie la dirección, o se debe asociar una Elastic IP.

## Despliegue actual en VPS con Coolify

El diagrama detallado separa cuatro niveles que no deben confundirse:

1. **Fuente Git:** GitHub contiene el código. Coolify se conecta mediante GitHub App, deploy key o URL HTTPS y queda asociado al repositorio y rama configurados.
2. **Boundary de Coolify:** Coolify administra el servidor conectado, configura variables y secretos, crea redes, volúmenes, rutas del proxy y ordena los despliegues. En el diagrama, este boundary contiene el runtime Docker, la red de aplicación y la red de monitoreo.
3. **Runtime dentro del boundary:** Docker Engine es quien realmente ejecuta los contenedores. Coolify no reemplaza a Docker Engine ni debe representarse como una aplicación de negocio.
4. **Redes internas dentro del boundary:** la aplicación y el monitoreo se modelan como redes Docker separadas. Los puertos internos sirven para comunicación entre contenedores; únicamente el proxy, Coolify y el acceso temporal de Grafana requieren publicación al exterior.

La fuente Mermaid complementaria expresa una relación directa desde `Coolify GitHub App` hacia el boundary `Red Docker interna — aplicación`. Archify mantiene la vista validada, pero su esquema de arquitectura solo permite que una relación termine en un componente, no en un boundary; por eso no se añadió un componente artificial para representar esa conexión.

### Fuentes aceptadas por Coolify

| Fuente | Qué ocurre | Uso en este proyecto |
|---|---|---|
| Repositorio GitHub con `docker-compose.yml` | Coolify obtiene el repositorio, lee el Compose y despliega sus servicios | Opción principal para la aplicación y para mantener cambios versionados |
| Repositorio GitHub con `Dockerfile` | Coolify construye una imagen desde el contexto del repositorio | Alternativa para empaquetar un servicio individual |
| Docker Compose pegado en Coolify | Coolify crea un Service administrado, pero no existe una fuente Git ni webhook del repositorio | Útil para el stack de monitoreo creado manualmente |
| Imagen Docker | Coolify descarga y ejecuta una imagen ya construida | Útil para exporters y componentes publicados |

No se deben activar simultáneamente dos disparadores para el mismo recurso. Si la aplicación se despliega mediante Coolify GitHub App, GitHub Actions no debe hacer además un `git pull` y un segundo despliegue SSH para esa misma aplicación. Si se conserva el flujo SSH actual, Coolify debe quedar fuera de ese recurso o utilizarse únicamente para el stack que administra.

**Estado documentado de esta instalación:** el workflow existente de la aplicación todavía utiliza GitHub Actions → SSH → `git pull` → `scripts/deploy.sh` en el VPS, mientras que el stack de monitoreo se creó como Compose administrado por Coolify. El diagrama actualizado documenta la arquitectura objetivo recomendada: GitHub → Coolify → Docker Engine. Para migrar la aplicación a este flujo, se debe crear en Coolify una Application desde el repositorio GitHub, seleccionar la rama, elegir Docker Compose como build pack y configurar sus variables, puertos y dominios. GitHub Actions queda como alternativa externa, no como parte del VPS ni del boundary de Coolify.

### Matriz de puertos

| Alcance | Puerto | Componente | Exposición |
|---|---:|---|---|
| Público | 80/443 | Proxy de Coolify | Entrada HTTP/HTTPS |
| Administración | 8000 | Coolify | Dashboard del servidor; restringir si es posible |
| Demostración | 3000 | Grafana | Acceso temporal; preferir proxy/autenticación |
| Docker interno | 80 | Frontend Nginx | Solo detrás del proxy |
| Docker interno | — | Worker Go | Sin puerto público; usa PostgreSQL, RabbitMQ y Open-Meteo |
| Docker interno | 8080 | API Go/Fiber | Solo frontend/proxy |
| Docker interno | 8000 | ML Python | Solo RabbitMQ/API interno |
| Docker interno | 5432 | PostgreSQL | Solo API, Worker y ML |
| Docker interno | 5672 | RabbitMQ AMQP | Solo Worker y ML |
| Docker interno | 15672 | RabbitMQ Management | No publicar en Internet |
| Docker interno | 9090 | Prometheus | Solo Grafana/administración |
| Docker interno | 3100 | Loki | Solo Grafana/Alloy |
| Docker interno | 12345 | Alloy | Métricas/estado interno |
| Docker interno | 8080 | cAdvisor | Scrape interno; evitar confundirlo con la API |
| Docker interno | 9100 | Node Exporter | Scrape interno |

La numeración puede repetirse porque cada contenedor tiene su propio namespace de red. Por ejemplo, la API y cAdvisor pueden usar el puerto interno `8080` sin conflicto; el conflicto solo existiría si ambos intentaran publicar el mismo puerto en el host.

## Evidencia de implementación

El archivo fuente del diagrama está asociado al commit de referencia `97eb93c53a9601c048a76db9412f8962155cb5f6` y enlaza componentes con archivos reales del repositorio, entre ellos:

- `.github/workflows/deploy-ec2.yml`
- `docker-compose.yml`
- `scripts/deploy.sh`
- `backend/cmd/api/main.go`
- `backend/internal/adapters/http/api.go`
- `db/migrations/001_initial.up.sql`
- `backend/internal/adapters/messaging/publisher.go`
- `ml-service/worker.py`

Para regenerar el HTML después de cambiar la arquitectura:

```bash
cd /Users/juancx/Documents/CX-Developments/LABS/Experimentals/archify/archify
node bin/archify.mjs validate architecture \
  /Users/juancx/Documents/CX-Developments/SELF/Proyecto-aplicaciones-para-la-nube/docs/architecture/derrepente.architecture.json \
  --quality showcase \
  --repo-root /Users/juancx/Documents/CX-Developments/SELF/Proyecto-aplicaciones-para-la-nube \
  --json
```

