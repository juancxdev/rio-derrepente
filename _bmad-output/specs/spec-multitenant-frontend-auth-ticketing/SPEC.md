---
id: SPEC-multitenant-frontend-auth-ticketing
companions:
  - implementation-contract.md
sources: []
---

# Frontend multitenant con autenticación y venta de tickets

## Why

El frontend actual parece un dashboard de un único destino: no identifica al operador, no permite iniciar sesión y la venta de tickets no ofrece un flujo comprobable. Esto impide demostrar el objetivo SaaS multitenant y deja al encargado sin una forma confiable de registrar las visitas reales que alimentan el cierre diario y la predicción.

## Capabilities

- **CAP-1**
  - **intent:** El operador puede iniciar sesión y continuar dentro de una sesión asociada a un tenant y permisos concretos.
  - **success:** Un usuario no autenticado solo ve login; con credenciales válidas ve su tenant, su nombre, rol y destinos permitidos; credenciales inválidas muestran un error sin crear sesión.

- **CAP-2**
  - **intent:** El operador puede identificar su tenant, consultar sus destinos y cambiar el destino activo sin exponer datos de otro tenant.
  - **success:** El selector solo muestra destinos devueltos para la identidad autenticada y cada petición protegida es rechazada si el destino no pertenece al tenant.

- **CAP-3**
  - **intent:** El encargado puede emitir tickets presenciales del día y confirmar que cada ticket representa una visita real.
  - **success:** Una venta válida muestra cantidad, códigos y estado exitoso; cantidades inválidas, sesión vencida, conflicto y error de red muestran mensajes diferenciados y no presentan una venta como exitosa.

- **CAP-4**
  - **intent:** El operador puede consultar el estado del cierre automático y las predicciones persistidas del destino activo.
  - **success:** Antes del cierre, mañana aparece como pendiente; después del cierre, la UI muestra procesamiento y luego la predicción guardada por ML, sin depender de localStorage ni de un registro manual del navegador.

- **CAP-5**
  - **intent:** El operador puede navegar por resumen, ventas, históricos, destinos, administración y monitoreo mediante una interfaz consistente y escalable.
  - **success:** Todas las vistas reutilizan tokens, shell, sidebar, formularios, tablas, badges, estados vacíos, errores y foco accesible en desktop y móvil.

## Constraints

- El aislamiento no puede depender de `VITE_TENANT_ID`; el backend debe obtener el tenant desde la sesión autenticada y verificarlo en cada endpoint protegido.
- La autenticación de esta iteración debe ser local y demostrable, con contraseña almacenada como hash y token firmado; no se incorpora un proveedor externo.
- La venta debe llamar una API real tenant-scoped y persistir en PostgreSQL; mocks solo se permiten en pruebas.
- Las migraciones deben ser aditivas y conservar el volumen PostgreSQL, tickets, históricos y cierres existentes.
- Los diagramas existentes en `docs/architecture` se conservan sin editar en esta iteración.
- La UI debe usar el sistema de diseño y el patrón de sidebar adaptable del POS como referencia conceptual, sin copiar código.

## Non-goals

- Pagos en línea, QR, escáner, reservas, facturación electrónica o pasarela de pagos.
- Roles avanzados, SSO, recuperación de contraseña, MFA o proveedor externo de identidad.
- Reemplazar el Worker Go, RabbitMQ, Open-Meteo o el servicio ML.
- Convertir la venta en una reserva futura: solo se venden tickets para el día local actual.

## Success signal

Con una cuenta de prueba, el operador entra, observa su tenant y destino, emite dos tickets y ve sus códigos. Otro tenant no puede consultar ni vender sobre ese destino. Al ejecutar el Worker, el cierre y el evento ML generan una predicción persistida que aparece en el dashboard sin intervención manual del navegador.

## Assumptions

- Para la demostración se podrá crear un usuario inicial mediante seed controlado o variables de entorno, sin presentar ese seed como dato turístico.
- La primera versión puede usar un token JWT en memoria del navegador, con expiración y cierre de sesión; la persistencia definitiva de sesión queda para una iteración posterior.

## Open Questions

- ¿El profesor exige que el login se conecte a un proveedor externo o basta una autenticación local para esta evaluación?
