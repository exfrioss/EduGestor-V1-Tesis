# API de infraestructura

## `GET /health`

Comprueba la disponibilidad de la API y ejecuta `SELECT 1` contra PostgreSQL.

Respuesta saludable (`200`):

```json
{
  "status": "ok",
  "database": "available"
}
```

Respuesta degradada (`503`):

```json
{
  "status": "degraded",
  "database": "unavailable"
}
```

## Autenticación Hito 1

Todas las respuestas de autenticación incluyen `Cache-Control: no-store`. Los errores siguen el contrato:

```json
{
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Se requiere una sesión válida",
    "requestId": "uuid"
  }
}
```

### `POST /api/v1/auth/login`

Entrada:

```json
{
  "login": "usuario",
  "password": "contraseña"
}
```

Con credenciales válidas devuelve `200`, una proyección segura del usuario y la expiración absoluta:

```json
{
  "user": {
    "id": "uuid",
    "login": "usuario",
    "accountKind": "STANDARD",
    "teacher": null
  },
  "session": {
    "expiresAt": "2026-09-25T00:00:00.000Z"
  }
}
```

El token opaco se entrega exclusivamente mediante la cookie configurada —`edugestor_session` por defecto— con `HttpOnly`, `SameSite=Lax`, `Path=/`, expiración absoluta y `Secure` en producción. Nunca se devuelve en JSON ni se almacena en el navegador mediante `localStorage` o `sessionStorage`.

Usuario inexistente, contraseña incorrecta, `User` inactivo y `Teacher` inactivo devuelven el mismo `401 INVALID_CREDENTIALS`. Una entrada inválida devuelve `400 VALIDATION_ERROR`. El límite por IP devuelve `429 LOGIN_RATE_LIMITED`.

### `GET /api/v1/auth/session`

Requiere la cookie de sesión. Devuelve `200` con la misma proyección segura de usuario y expiración. Una cookie ausente, desconocida, vencida, revocada o perteneciente a una cuenta desactivada devuelve `401 AUTHENTICATION_REQUIRED`.

La lectura puede actualizar `lastSeenAt` cuando supera el intervalo configurado. Esta actualización nunca cambia `expiresAt`.

### `GET /api/v1/auth/csrf`

Requiere sesión válida. Devuelve un token anti-CSRF y establece la cookie legible configurada —`edugestor_csrf` por defecto—:

```json
{
  "csrfToken": "token-anti-csrf"
}
```

Este valor no autentica al usuario. Las operaciones mutables autenticadas deben enviar simultáneamente la cookie y el mismo valor en `X-CSRF-Token`.

### `POST /api/v1/auth/logout`

Requiere sesión válida y protección CSRF. Revoca la fila `AuthSession`, limpia ambas cookies y devuelve `204` sin cuerpo. Una sesión ausente/inválida devuelve `401`; CSRF ausente o discordante devuelve `403 CSRF_TOKEN_INVALID`.

## Sesiones y seguridad

- Los tokens de sesión contienen 256 bits aleatorios y PostgreSQL almacena únicamente su hash SHA-256.
- La expiración es absoluta; por defecto dura 8 horas y no se renueva por actividad.
- Logout y desactivación de `User`/`Teacher` revocan sesiones persistidas.
- Login y logout se auditan sin guardar login enviado, contraseña, hash, cookie, token opaco ni token CSRF.
- El rate limiting actual usa memoria de la instancia Node. Un despliegue con múltiples réplicas debe usar un store compartido.
- `requireAuthenticated` es el middleware base para rutas privadas. Las futuras rutas mutables con cookie deberán incorporar también la comprobación CSRF.

## Autorización jerárquica Hito 1

Todas las rutas siguientes requieren una sesión válida y responden con `Cache-Control: no-store`. La ausencia de sesión devuelve `401 AUTHENTICATION_REQUIRED`. Las decisiones se toman en el backend con permisos explícitos; un rol no concede capacidades por sí mismo.

### `GET /api/v1/authorization/check/:resourceType/:resourceId/:permissionCode`

Comprueba un permiso del catálogo sobre el recurso real. Los tipos admitidos son `institution`, `teacherInstitution`, `course`, `subject` y `teachingAssignment`. El backend resuelve institución y curso desde PostgreSQL; no confía en un scope enviado por el cliente.

Respuesta permitida (`200`):

```json
{
  "authorized": true
}
```

Una decisión negativa devuelve `403 PERMISSION_DENIED`; no expone concesiones, roles, ámbitos ni razones internas. Un permiso desconocido o referencia inválida devuelve `400`; un recurso inexistente devuelve `404 RESOURCE_NOT_FOUND`.

### `GET /api/v1/authorization/teaching-assignments/:assignmentId/access`

Comprueba el acceso operativo propio del docente. Devuelve `200 { "authorized": true }` únicamente cuando la sesión pertenece al docente activo de una `TeachingAssignment` vigente. Una asignación ajena, finalizada o perteneciente a un docente inactivo devuelve `403 TEACHING_ASSIGNMENT_ACCESS_DENIED` sin revelar su contenido.

### `POST /api/v1/authorization/grants`

Requiere protección CSRF. Crea una concesión delegada solo si el actor posee `administration.delegate` y cada permiso solicitado en un ámbito que contiene completamente al nuevo ámbito.

```json
{
  "targetUserId": "uuid",
  "roleId": "uuid",
  "scope": {
    "kind": "COURSE_SET",
    "institutionId": "uuid",
    "courseIds": ["uuid"]
  },
  "permissions": ["course.read", "teaching-assignment.read"]
}
```

También se admite `INSTITUTION` sin `courseIds`. `RESOURCE_SET` devuelve `400 RESOURCE_SET_NOT_SUPPORTED`. La autodelegación, un permiso no poseído o un ámbito superior devuelven `403 DELEGATION_DENIED`. En éxito devuelve `201` con la proyección de la concesión; no expone `parentGrantId` ni la cadena interna.

### `POST /api/v1/authorization/grants/:assignmentId/revoke`

Requiere protección CSRF y `administration.revoke` dentro de un ámbito que contenga la concesión. Revoca atómicamente la asignación, sus permisos y los descendientes derivados; devuelve `204`. Fuera del ámbito devuelve `403 DELEGATION_DENIED` y una concesión inexistente o ya revocada devuelve `404 GRANT_NOT_FOUND`.

### Catálogo de permisos

El catálogo del checkpoint contiene 13 códigos: lectura/administración de instituciones, docentes, cursos, materias y `TeachingAssignment`; delegación; revocación; y lectura de auditoría. Se sincroniza idempotentemente con:

```bash
npm run bootstrap:authorization-catalog -w @edugestor/api
```

No contiene permisos de estudiantes, tareas, evaluaciones, asistencia, currículo, planificación ni IA.
