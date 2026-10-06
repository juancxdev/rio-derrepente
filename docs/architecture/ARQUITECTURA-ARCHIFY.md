# Arquitectura de la plataforma Río Derrepente

Este documento acompaña al diagrama interactivo generado con Archify:

- [Abrir diagrama de arquitectura](./derrepente.architecture.html)
- Archivo fuente: [`derrepente.architecture.json`](./derrepente.architecture.json)

El diagrama está pensado para una revisión técnica y también para una exposición. Las etiquetas están redactadas en español; la interfaz del visor de Archify puede aparecer en inglés según la versión instalada.

## Qué representa el diagrama

La arquitectura se organiza en tres vistas guiadas:

1. **Lectura operativa:** muestra cómo los encargados y comerciantes consultan el dashboard, cómo el frontend llama al API y cómo el API devuelve datos persistidos.
2. **Entrenamiento y predicción asíncrona:** muestra el registro diario, el evento publicado en RabbitMQ, el procesamiento del microservicio ML y el guardado de la predicción.
3. **Despliegue:** muestra el flujo `push a main → GitHub Actions → SSH a EC2 → actualización y migraciones`.

## Componentes principales

| Componente | Responsabilidad |
|---|---|
| Dashboard React | Presenta el pronóstico, el clima y el formulario de registro diario. Consume únicamente el API público del backend. |
| API Go/Fiber | Expone los endpoints, valida solicitudes, obtiene el clima, registra visitantes y consulta predicciones. |
| PostgreSQL | Mantiene sitios, clima observado, visitas, predicciones y metadatos de entrenamiento. Usa migraciones versionadas y volumen persistente. |
| RabbitMQ | Desacopla el registro de visitantes del cálculo ML. Permite reintentos y evita que una caída del worker afecte al API. |
| Microservicio ML | Consume eventos, construye las características, ejecuta XGBoost Regressor y guarda el pronóstico del día siguiente. |
| Open-Meteo | Fuente meteorológica usada por el backend y el microservicio para obtener datos del punto turístico. |
| GitHub Actions | Ejecuta el pipeline de despliegue cuando se actualiza `main`. |
| Amazon EC2 | Ejecuta Docker Compose con frontend, API, PostgreSQL, RabbitMQ y ML. |

## Flujo 1: consulta del dashboard

1. Un encargado abre el dashboard publicado en el puerto `3000`.
2. El frontend solicita al API el resumen, el pronóstico de afluencia y el pronóstico meteorológico.
3. El API consulta PostgreSQL para obtener los datos ya calculados.
4. El API consulta Open-Meteo cuando necesita actualizar o mostrar el clima.
5. El frontend presenta la información sin ejecutar el modelo ML.

La predicción no se recalcula en cada consulta. Esto mantiene la respuesta rápida y evita consumir recursos innecesariamente.

## Flujo 2: registro y predicción diaria

1. Después de las `18:00` en la zona horaria `America/Lima`, el dashboard habilita el registro de visitantes del día.
2. El API obtiene o valida los datos meteorológicos y persiste el registro en PostgreSQL.
3. El API publica un evento en RabbitMQ.
4. El microservicio ML consume el evento de manera independiente.
5. El microservicio prepara las variables del modelo: visitas recientes, día de semana, mes, lluvia, temperatura y demás variables disponibles.
6. XGBoost Regressor calcula la puntuación o afluencia estimada para el día siguiente.
7. La predicción queda almacenada en PostgreSQL.
8. La siguiente consulta del dashboard lee esa predicción persistida.

El bloqueo de las `18:00` es inicialmente una regla visual del frontend. La validación definitiva debe mantenerse también en backend antes de usar el sistema en producción.

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

