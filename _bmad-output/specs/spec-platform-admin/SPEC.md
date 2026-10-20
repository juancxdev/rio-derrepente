---
id: SPEC-platform-admin
companions: [platform-model.md]
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Super administrador de plataforma y login neutral

## Why

**A pain to solve.** El portal multitenant muestra la marca de un solo operador (Río Derrepente) y no existe una identidad inicial conocida para entrar. Sin un administrador de plataforma, nadie puede crear operadores, destinos ni cuentas para los administradores de cada operador. Esto bloquea la puesta en marcha y contradice el modelo multitenant.

## Capabilities

- **CAP-1**
  - **intent:** Un operador ve un login con identidad neutral del producto, sin la marca de ningún tenant, para entender que entra a una plataforma multitenant.
  - **success:** La pantalla de login no contiene "Río Derrepente" ni nombres de operadores; muestra el nombre neutral del producto y el subtítulo de plataforma.
- **CAP-2**
  - **intent:** Un super administrador entra a una consola de plataforma desde la que lista y crea operadores, destinos por operador y cuentas con rol para cada operador.
  - **success:** Puede crear un operador, un destino y una cuenta `admin`; esa cuenta inicia sesión después y solo ve el tenant asignado.
- **CAP-3**
  - **intent:** La API expone rutas de administración de plataforma protegidas exclusivamente para super administradores.
  - **success:** Un usuario de tenant recibe `403` en `/api/v1/admin/*`; una petición sin token recibe `401`; el super administrador recibe `200`/`201`.
- **CAP-4**
  - **intent:** El super administrador se crea o rota sin contraseñas por defecto ni secretos en el repositorio.
  - **success:** `adminctl create-superadmin` solicita la contraseña de forma oculta o la genera; no existe ninguna contraseña conocida en código, `.env.example`, Compose, frontend ni README.

## Constraints

- El login usa una identidad de producto neutral; el nombre del tenant solo aparece después de autenticarse.
- El super administrador es una identidad de plataforma sin membresía de tenant, modelada con `users.is_super_admin` y rol `super_admin`.
- No existen contraseñas por defecto. El super administrador se crea o rota con `adminctl create-superadmin`, que recibe la clave por terminal oculta, `--password-stdin` o `--generate`.
- `adminctl` solo persiste el hash bcrypt; las contraseñas no se leen de `.env`, `docker-compose.yml`, código fuente ni documentación.
- El seed de demo de tenant exige `DEMO_USER_EMAIL` y `DEMO_USER_PASSWORD` explícitos; no tiene valores por defecto.
- El sidebar replica el comportamiento de POS: riel colapsable con tooltips en escritorio y drawer superpuesto en móvil.
- Las rutas normales siguen tomando el tenant del token; las rutas `/api/v1/admin` no aceptan un tenant arbitrario del cliente.
- La migración es aditiva: no borra tenants, sitios, tickets, visitas ni cierres existentes.
- No se implementa autoservicio, facturación, recuperación de contraseña ni invitaciones por correo en esta iteración.

## Non-goals

- Registro público de operadores o autoservicio.
- Recuperación o cambio de contraseña desde la UI.
- Facturación, planes o límites comerciales.
- Edición o borrado de operadores, destinos o cuentas existentes.

## Success signal

Un login limpio muestra Afluencia; el super administrador crea un operador, un destino y una cuenta admin; esa cuenta entra y solo ve su tenant.

## Assumptions

- El nombre visible del producto será **Afluencia**, con el subtítulo "Plataforma de operación turística". Es un placeholder neutral reemplazable.
- El correo del super administrador se elige al ejecutar `adminctl`; no hay un correo hardcodeado en la aplicación.
- Los roles asignables desde la consola de plataforma son `operator`, `manager` y `admin`; `super_admin` no se asigna desde la UI.
- El operador inicial y su destino existentes se conservan y aparecen en la lista del super administrador.

## Open Questions

- ¿Afluencia es el nombre comercial definitivo o solo un placeholder neutral?
- ¿Se necesita más adelante cambio de contraseña y desactivación de cuentas desde la consola de plataforma?
