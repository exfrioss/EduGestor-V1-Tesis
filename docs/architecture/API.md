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

## Núcleo institucional y académico Hito 1

Todas estas rutas requieren cookie de sesión válida y devuelven `Cache-Control: no-store`. `POST` y `PATCH` requieren además cookie CSRF y `X-CSRF-Token`. No existen rutas `DELETE`: la desactivación o el retiro conservan UUID, relaciones e historial.

La autorización se resuelve dentro de los servicios. Las lecturas requieren el permiso `.read` correspondiente y las mutaciones `.manage`, siempre sobre un scope que contenga la institución o el curso afectado.

### Instituciones

| Método y ruta | Descripción |
|---|---|
| `POST /api/v1/institutions` | Bootstrap excepcional de institución. Solo cuenta `TECHNICAL`; exige `technicalReason`. |
| `GET /api/v1/institutions` | Lista únicamente instituciones con `institution.read` efectivo. |
| `GET /api/v1/institutions/:institutionId` | Consulta autorizada. |
| `PATCH /api/v1/institutions/:institutionId` | Actualiza el nombre. |
| `POST /api/v1/institutions/:institutionId/deactivate` | Desactiva sin cascada ni borrado. |
| `POST /api/v1/institutions/:institutionId/activate` | Activa la misma institución. |
| `POST /api/v1/institutions/:institutionId/reactivate` | Alias explícito de reactivación. |

La creación inicial no puede autorizarse mediante un scope de la misma institución antes de que esta exista. Conforme a `DATABASE.md`, permanece reservada al bootstrap técnico auditado. Una cuenta administrativa ordinaria recibe después concesiones explícitas sobre la institución creada.

### Docentes y cuentas

Base: `/api/v1/institutions/:institutionId/teachers`.

| Método y sufijo | Descripción |
|---|---|
| `POST /` | Crea perfil y vínculo; puede crear una cuenta `STANDARD` o utilizar un `userId` existente disponible. |
| `GET /` | Lista docentes vinculados histórica o actualmente a la institución. |
| `GET /:teacherId` | Consulta la proyección segura de docente, cuenta y vínculos. |
| `PATCH /:teacherId` | Actualiza `displayName`. |
| `POST /:teacherId/deactivate` | Desactiva docente y revoca sesiones. |
| `POST /:teacherId/activate` o `/reactivate` | Reactiva el perfil sin crear sesión ni permiso. |
| `POST /:teacherId/link` | Crea o rehabilita `TeacherInstitution`. |
| `POST /:teacherId/unlink` | Finaliza el vínculo mediante `endedAt`. |

Creación con cuenta nueva:

```json
{
  "displayName": "Docente Uno",
  "account": {
    "kind": "NEW",
    "login": "docente.uno",
    "password": "secreto-entregado-fuera-de-logs"
  }
}
```

La respuesta nunca contiene contraseña ni `passwordHash`.

### Años lectivos

| Método y ruta | Descripción |
|---|---|
| `POST /api/v1/institutions/:institutionId/academic-years` | Crea año lectivo; usa `course.manage`. |
| `GET /api/v1/institutions/:institutionId/academic-years` | Lista años autorizados. |
| `GET /api/v1/institutions/:institutionId/academic-years/current` | Devuelve el año marcado `isCurrent`; `404` si no existe. |
| `GET /api/v1/academic-years/:academicYearId` | Consulta individual. |
| `PATCH /api/v1/academic-years/:academicYearId` | Actualiza etiqueta, fechas o `isCurrent`. |

`startsOn` debe ser anterior o igual a `endsOn`; no puede haber dos filas `isCurrent=true` para una institución.

### Cursos

| Método y ruta | Descripción |
|---|---|
| `POST /api/v1/courses` | Crea curso con `institutionId`, `academicYearId`, `grade`, `section`, `shift` y `btiYear` opcional (`1`, `2`, `3` o `null`). |
| `GET /api/v1/courses?institutionId=uuid` | Lista solo cursos cubiertos por las concesiones del actor. |
| `GET /api/v1/courses/:courseId` | Consulta individual autorizada. |
| `PATCH /api/v1/courses/:courseId` | Actualiza contexto permitido y descriptores. No cambia el año si ya existe historia de asignaciones. |
| `POST /api/v1/courses/:courseId/deactivate` | Desactiva sin borrar. |
| `POST /api/v1/courses/:courseId/activate` o `/reactivate` | Reactiva el curso. |

Grado, sección y turno se normalizan antes de aplicar la unicidad institucional/año/curso. `btiYear` identifica explícitamente el año BTI cuando corresponde; no se infiere desde `grade`.

### Materias

| Método y ruta | Descripción |
|---|---|
| `POST /api/v1/subjects` | Crea materia institucional genérica. |
| `GET /api/v1/subjects?institutionId=uuid` | Lista materias autorizadas. |
| `GET /api/v1/subjects/:subjectId` | Consulta individual. |
| `PATCH /api/v1/subjects/:subjectId` | Actualiza el nombre institucional. |
| `POST /api/v1/subjects/:subjectId/deactivate` | Desactiva sin borrar. |
| `POST /api/v1/subjects/:subjectId/activate` o `/reactivate` | Reactiva la materia. |

`Subject` no contiene una clasificación curricular embebida. Las futuras referencias se expresan mediante `SubjectCurriculumMapping`; este checkpoint no publica rutas para administrar esas correspondencias y una materia funciona sin ellas.

### Asignaciones docentes

| Método y ruta | Descripción |
|---|---|
| `POST /api/v1/teaching-assignments` | Crea una terna docente–curso–materia coherente y activa. |
| `GET /api/v1/teaching-assignments?institutionId=uuid` | Lista administrativa filtrada por permiso/scope; admite `courseId`, `teacherId` e `includeEnded`. |
| `GET /api/v1/teaching-assignments/:assignmentId` | Lectura administrativa autorizada o lectura docente propia vigente. |
| `POST /api/v1/teaching-assignments/:assignmentId/retire` | Fija `endedAt`; no borra ni reatribuye historia. |
| `POST /api/v1/teaching-assignments/:assignmentId/reactivate` | Limpia `endedAt` solo si todo el contexto vuelve a estar activo. |
| `GET /api/v1/me/teaching-assignments` | Lista únicamente asignaciones vigentes del docente autenticado. |

La creación valida docente y cuenta activos, vínculo `TeacherInstitution` vigente, institución/curso/materia activos, contexto institucional idéntico y terna no duplicada. El UUID de una asignación ajena no concede acceso.

Conflictos de unicidad devuelven `409 CONFLICT`; contexto o estado inválido devuelve `400 VALIDATION_ERROR`; falta de permiso devuelve `403 PERMISSION_DENIED`.

## Consumo desde el frontend del Hito 1

El frontend no incorpora endpoints adicionales. Envía cookies con `credentials: "include"`, obtiene CSRF mediante `GET /api/v1/auth/csrf` y adjunta `x-csrf-token` en toda mutación. Nunca recibe ni persiste el token opaco de sesión.

Como la API no expone una lista agregada de capacidades, la entrada administrativa usa `GET /api/v1/institutions` como proyección autorizada y cada control mutable consulta `GET /api/v1/authorization/check/:resourceType/:resourceId/:permissionCode`. Ocultar un control es solo una ayuda de interfaz: todas las operaciones continúan sujetas a la autorización backend.

No se alteraron contratos, códigos de respuesta ni rutas durante el checkpoint frontend.
