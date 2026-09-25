# Changelog

## 25/09/2026 — Validación real y cierre técnico del Hito 1

- Se añadió `bootstrap:hito1-demo`, un provisionador CLI idempotente limitado a `development`/`test`, configurado íntegramente mediante variables de entorno y auditado sin secretos.
- Se incorporó un dataset ficticio reproducible con administrador institucional, institución, año lectivo, dos docentes/cuentas, curso, materia, asignaciones y concesiones completas del Hito 1.
- Se agregó un E2E Playwright real que usa React, Express y PostgreSQL sin interceptar API, sesión, permisos ni persistencia.
- Se comprobó el recorrido administrador/docente, el aislamiento por UUID, la conservación de datos tras reiniciar API/web y la existencia de auditoría.
- Se mantuvo separado el E2E simulado para validación rápida del frontend.
- Se reforzaron foco de ruta, foco visible, tabulación, contraste y acceso al logout en ancho móvil.
- Se aplicaron las cuatro migraciones desde una base vacía y la integración PostgreSQL completa aprobó 60/60 pruebas; los E2E simulado y real aprobaron 1/1 cada uno.
- No se modificaron el schema Prisma, las migraciones ni las especificaciones normativas, y no se añadieron módulos académicos.

## 25/09/2026 — Frontend del Hito 1

- Se reemplazó el scaffold por una aplicación React responsive con autenticación, restauración de sesión, logout, CSRF en memoria y transporte `credentials: "include"`.
- Se añadieron rutas privadas, redirección basada en capacidades observadas en backend, `PermissionGate`, layouts administrativo/docente y páginas 403/404.
- Se implementó el recorrido administrativo de instituciones, docentes/cuentas, años lectivos/cursos, materias y asignaciones docentes usando exclusivamente la API existente.
- Se incorporó “Mis asignaciones” para docentes sin controles administrativos implícitos.
- Se añadieron estados de carga, vacío, éxito/error, confirmaciones y manejo explícito de 401/403/409/422.
- Se agregaron 8 pruebas React Testing Library y un recorrido Playwright completo con datos ficticios; ambos aprobaron.
- No se modificaron Prisma, migraciones, API backend ni especificaciones normativas.

## 25/09/2026 — Núcleo institucional y académico backend del Hito 1

- Se añadió el módulo `academic` con separación controller, servicio, repositorio y Prisma.
- Se implementaron operaciones privadas y autorizadas de instituciones, años lectivos, docentes/cuentas/vínculos, cursos, materias y asignaciones docentes.
- Se añadió creación transaccional de cuenta, perfil docente y vínculo institucional, conservando credenciales únicamente como hash `scrypt`.
- Se implementaron activación, desactivación y reactivación sin borrado físico; desactivar docente revoca sesiones existentes.
- Se normalizan grado, sección, turno y nombres comparables antes de aplicar las restricciones únicas.
- Se implementó validación completa y retiro lógico de `TeachingAssignment`, junto con el endpoint docente `GET /api/v1/me/teaching-assignments`.
- Se incorporó auditoría de mutaciones exitosas y rechazos relevantes sin secretos.
- Se añadieron reintentos acotados para conflictos de transacciones serializables `P2034`.
- Se agregaron 2 pruebas unitarias de normalización, los 17 casos obligatorios y una prueba HTTP adicional de sesión/CSRF; la regresión PostgreSQL completa aprobó 56/56 pruebas.
- No se modificó el schema Prisma ni se implementaron estudiantes, tareas, asistencia, currículo, planificación, IA o frontend funcional.

## 25/09/2026 — Motor de autorización jerárquica del Hito 1

- Se implementó autorización con denegación por defecto, permisos explícitos y ámbitos `INSTITUTION`/`COURSE_SET`, sin combinar permiso y scope de concesiones diferentes.
- Se añadió validación completa de la cadena `parentGrantId`, raíces técnicas, revocación efectiva, múltiples roles sin escalamiento implícito e inmutabilidad de procedencia.
- Se incorporaron `requirePermission`, resolución del ámbito real del recurso y aislamiento de `TeachingAssignment` por docente.
- Se implementó delegación D-01 con control de subconjunto de permisos, contención de ámbito, rechazo de autodelegación/ciclos y revocación de descendientes.
- Se agregó un catálogo idempotente de 13 permisos del Hito 1 y el comando `bootstrap:authorization-catalog`.
- Se añadieron las rutas mínimas de comprobación, concesión y revocación bajo `/api/v1/authorization`, con sesión, CSRF y auditoría sin secretos.
- Se crearon las migraciones `20260925010000_authorization_invariants` y `20260925011000_allow_permission_revocation` para restricciones no representables por Prisma.
- Se agregaron 16 pruebas de integración de autorización; la suite completa sobre PostgreSQL real aprobó 36/36 pruebas.
- No se implementaron CRUD administrativos, pantallas, `RESOURCE_SET` ni módulos posteriores al Hito 1.

## 24/09/2026 — Autenticación y sesiones del Hito 1

- Se añadieron login, logout, consulta de sesión y entrega de token CSRF bajo `/api/v1/auth`.
- Se implementaron sesiones opacas persistidas, hashing SHA-256 del token, cookie HttpOnly/SameSite y Secure en producción, expiración absoluta, revocación y actualización acotada de actividad.
- Se incorporó `requireAuthenticated`, protección CSRF por doble envío, respuestas sin caché y respuesta uniforme ante credenciales o cuentas inválidas.
- Se añadió rate limiting configurable para login y auditoría de intentos/resultados sin secretos.
- Se creó la migración `20260924170000_auth_session_revocation`, que revoca sesiones al desactivar usuarios o docentes.
- Se agregaron pruebas unitarias e integración PostgreSQL para los recorridos positivos, negativos, seguridad de cookies, revocación, CSRF, rate limiting y no exposición de secretos.
- No se implementaron JWT, almacenamiento web de credenciales, permisos/ámbitos efectivos, CRUD administrativo ni frontend de autenticación.

## 24/09/2026 — Persistencia y fundaciones backend del Hito 1

- Se incorporaron los 16 modelos aprobados para el checkpoint en Prisma.
- Se creó la migración inicial versionada `20260924160000_initial_hito1` con restricciones PostgreSQL adicionales.
- Se reemplazó el probe `pg` por acceso compartido mediante Prisma Client.
- Se añadieron configuración validada, request ID, errores uniformes, Helmet, CORS configurable y logging estructurado con redacción.
- Se añadieron contratos de repositorio y repositorios iniciales de usuario y auditoría.
- Se añadió hashing `scrypt` y el bootstrap raíz/técnico idempotente, configurado exclusivamente por entorno y auditado de forma atómica.
- La API contenedorizada aplica las migraciones pendientes antes de iniciar y recibe CORS/logging mediante variables de entorno.
- Se incorporaron pruebas unitarias y pruebas de integración de persistencia sobre PostgreSQL.
- No se añadieron pantallas, CRUD de negocio, estudiantes, evaluaciones, asistencia, currículo, planificación ni IA.
