# Changelog

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
