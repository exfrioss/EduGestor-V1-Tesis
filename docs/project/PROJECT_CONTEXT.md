# EduGestor V1.0 — Contexto de continuidad

## CHECKPOINT COMPLETADO — Autenticación y sesiones del Hito 1

**Fecha:** 24/09/2026.
**Estado:** estable; sin commit Git.

### Implementado

- Hashing y verificación de contraseñas con `scrypt`, sal aleatoria, parámetros documentados y comparación en tiempo constante.
- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/session` y `GET /api/v1/auth/csrf`.
- Sesiones opacas de 256 bits en `AuthSession`; PostgreSQL conserva exclusivamente el hash SHA-256 del token.
- Cookie de sesión HttpOnly, `SameSite=Lax`, `Secure` en producción, sin `localStorage`/`sessionStorage` y con expiración absoluta configurable de 8 horas por defecto.
- Revocación en logout, rechazo de sesiones expiradas/revocadas y actualización limitada de `lastSeenAt` sin extender `expiresAt`.
- Middleware exportado `requireAuthenticated` y respuesta uniforme para usuario inexistente, contraseña incorrecta, `User` inactivo o `Teacher` inactivo.
- Protección CSRF por doble envío para operaciones mutables autenticadas. El token CSRF no es credencial de sesión y la sesión nunca se entrega en JSON.
- Rate limiting de login por IP, configurable; los éxitos no consumen el límite definitivo.
- Auditoría de login exitoso, login denegado, limitación y logout, sin contraseñas, hashes, cookies ni tokens de sesión.
- Triggers PostgreSQL que revocan todas las sesiones al desactivar `User` o `Teacher`, además de la comprobación defensiva en cada autenticación.
- Respuestas de autenticación con `Cache-Control: no-store` y logging con redacción de secretos.

### Migración creada

- `apps/api/prisma/migrations/20260924170000_auth_session_revocation/migration.sql`.
- Añade triggers de revocación por desactivación sin modificar el modelo de dominio aprobado.
- Las dos migraciones se aplicaron desde bases vacías aisladas; la corrida final utilizó `edugestor_auth_race_20260924`.

### Pruebas ejecutadas y resultado

- Integración completa contra PostgreSQL real: 6 archivos y 20/20 pruebas aprobadas.
- Cubierto: login correcto; credenciales incorrectas; usuario inexistente; usuario/docente desactivado; cookie; persistencia sólo del hash; sesión válida, expirada y revocada; `lastSeenAt`; logout; ausencia de sesión; ausencia de CSRF; revocación masiva; rate limiting; ausencia de secretos en respuestas, auditoría y logs.
- `prisma validate`: aprobado.
- `prisma generate`: aprobado tras liberar un proceso local antiguo que mantenía bloqueado el binario de Prisma en Windows.
- `npm run typecheck`: aprobado en `shared`, `api` y `web`.
- `npm run build`: aprobado en los tres workspaces, incluido Vite.
- `npm test`: Shared 1, API 9 y Web 1 aprobadas; las 11 pruebas PostgreSQL se omiten por defecto y fueron ejecutadas por separado.

### Errores o límites pendientes

- Ningún error conocido dentro de este checkpoint.
- El rate limiting utiliza memoria del proceso, adecuado para la instancia única actual. Antes de desplegar varias réplicas debe configurarse un store compartido y atómico.
- Aún no se implementaron resolución de permisos/ámbitos, delegación, CRUD administrativo, aislamiento de asignaciones docentes ni frontend de login.

### Siguiente checkpoint exacto

Implementar exclusivamente el motor de autorización del Hito 1: resolución de `RoleAssignment` y `RoleAssignmentPermission` vigentes, ámbitos `INSTITUTION` y `COURSE_SET`, cadena de delegación efectiva, `requirePermission` y `requireOwnTeachingAssignment`, con pruebas de denegación por defecto, ámbitos distintos, múltiples roles, delegación excesiva y acceso docente a asignaciones propias/ajenas. No iniciar todavía CRUD administrativo ni módulos académicos posteriores.
