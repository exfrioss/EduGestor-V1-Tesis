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

El catálogo contiene 17 códigos: los 13 permisos del Hito 1 más los cuatro permisos curriculares documentados en esta sección. Se sincroniza idempotentemente con:

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


## Contratos aprobados — Administración curricular (25/09/2026)

**Estado: especificación aprobada; implementación HTTP/UX pendiente.** Las secciones anteriores describen los checkpoints ya implementados. Esta sección no declara disponibles nuevas rutas, permisos ni pruebas ejecutadas. La persistencia de PlanType, AcademicArea, CurriculumDiscipline y SubjectCurriculumMapping ya fue implementada y probada según PROJECT_CONTEXT.md. No se implementan anticipadamente Curriculum, capacidades, contenidos, indicadores, planificación ni IA.

### Permisos y compatibilidad con el catálogo implementado

Se verificó `permission-catalog.ts`: utiliza recurso singular y acción, en minúsculas, con kebab-case; por ejemplo `teaching-assignment.read`. `bootstrap-authorization-catalog.ts` sincroniza por `code` mediante upsert y actualiza descripciones; no concede por sí mismo roles ni permisos a usuarios.

| Código aprobado | Semántica | Autorización |
|---|---|---|
| `curriculum-catalog.read` | Consultar PlanType, AcademicArea y CurriculumDiscipline compartidos. | Permiso efectivo en un contexto institucional autorizado; no devuelve datos de otras instituciones. |
| `curriculum-catalog.manage` | Crear entradas y corregir/completar datos permitidos del catálogo compartido. | Autorización técnica excepcional explícita, cuenta TECHNICAL y motivo auditado; nunca derivada de una concesión institucional ordinaria. |
| `subject-curriculum-mapping.read` | Consultar correspondencias institucionales vigentes/históricas dentro del ámbito autorizado. | Institución o contexto de curso/asignación autorizado. |
| `subject-curriculum-mapping.manage` | Crear, retirar y sustituir correspondencias. | Permiso efectivo sobre la institución completa de Subject en este checkpoint. |

Los 13 códigos existentes permanecen intactos y los cuatro nuevos completan un catálogo de 17. No existen alias plurales `subject-curriculum-mappings.*`. `manage` no implica `read`; `subject.manage` no implica permisos curriculares. La sincronización idempotente no concede automáticamente los nuevos permisos a administradores ni al dataset demo.

El AccessScope aprobado es institucional; no se inventa GLOBAL ni una institución ficticia. La administración técnica compartida exige una comprobación explícita de la acción permitida por la política técnica excepcional, además de TECHNICAL, sesión, CSRF y `technicalReason`. La mera existencia del código en Permission o una concesión institucional no autoriza esa operación. Este permiso no se delega por la vía institucional ordinaria, ni siquiera mediante envío directo a `/authorization/grants`. Codex debe revisar el mecanismo técnico existente y aplicar denegación por defecto; no se presupone que los dos archivos de catálogo adjuntos implementen ya esa autorización.

`RESOURCE_SET` continúa rechazado con `400 RESOURCE_SET_NOT_SUPPORTED`. El modelo contempla autorización futura por recurso Subject, pero este checkpoint no exige habilitarla. Un scope COURSE_SET no permite escribir correspondencias compartidas por otras secciones/años lectivos.

### Convenciones de transporte y respuestas

Base `/api/v1`. Sesión vigente, `Cache-Control: no-store`, cookies con `credentials: include`; toda mutación exige cookie CSRF y `X-CSRF-Token`, conforme al Hito 1. UUID válidos; `btiYear` entero 1–3. Zod rechaza claves desconocidas o no editables. Autor, institución real, timestamps y retiro se resuelven en backend.

Estos contratos nuevos usan `{ "data": objeto }` para recursos y `{ "data": [], "nextCursor": null }` para listas, sin cambiar las respuestas de rutas existentes. Paginación: `limit` por defecto 25, entre 1 y 100; `cursor` opaco ligado a filtros/contexto y orden estable por UUID. Reautorizar cada página. No devolver totales ni filas fuera del ámbito.

Se conserva el sobre de error existente: `{ "error": { "code": "...", "message": "...", "requestId": "uuid" } }`. No se mueve requestId al nivel superior ni se introducen alias nuevos para errores de autenticación, autorización o CSRF.

### Lecturas del catálogo compartido

Todas requieren `curriculum-catalog.read`. `institutionId` en query identifica el contexto autorizado desde el que se accede a referencias compartidas; no asigna propiedad institucional al catálogo. Una concesión efectiva de lectura en dicho contexto permite exclusivamente esa lectura de referencia. Usuarios docentes requieren además su contexto operativo vigente según D-01; los administradores se evalúan mediante sus concesiones administrativas.

| Método y ruta | Request (query; sin body) | Response | Errores específicos |
|---|---|---|---|
| GET `/api/v1/curriculum/plan-types` | `institutionId`, `limit?`, `cursor?` | 200, lista de tipos de plan. | 400 filtros inválidos; 403 contexto sin autorización. |
| GET `/api/v1/curriculum/plan-types/:planTypeId/academic-areas` | `institutionId`, paginación | 200, áreas del plan; lista vacía válida. | 404 plan inexistente. |
| GET `/api/v1/curriculum/disciplines` | `institutionId`, `planTypeId?`, `academicAreaId?`, `areaStatus=known\|unknown?`, paginación | 200, disciplinas filtradas. | 400 filtros contradictorios; 404 referencia de filtro inexistente. |

Proyecciones: PlanType `{ id, code, name, rowVersion }`; AcademicArea `{ id, planTypeId, code, name, rowVersion }`; CurriculumDiscipline `{ id, planTypeId, academicAreaId, code, officialName, classificationStatus, rowVersion }`. `classificationStatus` deriva del área: INCOMPLETE si NULL, COMPLETE si informada/coherente. No equivale a malla validada. No se devuelven relaciones inversas con materias o instituciones.

### Escrituras excepcionales del catálogo

Todas requieren `curriculum-catalog.manage` bajo la política técnica excepcional, sesión, CSRF y `technicalReason` no vacío. La razón indica motivo y referencia oficial/validada que sustenta la operación; no es una carga de mallas. Se registra en AuditLog.

| Método y ruta | Request body | Response | Errores específicos |
|---|---|---|---|
| POST `/api/v1/curriculum/plan-types` | `{ code, name, technicalReason }` | 201, tipo creado. | 409 DUPLICATE_CODE. |
| PATCH `/api/v1/curriculum/plan-types/:id` | `{ name, expectedVersion, technicalReason }` | 200, tipo actualizado. | 404; 409 STALE_VERSION. |
| POST `/api/v1/curriculum/academic-areas` | `{ planTypeId, code, name, technicalReason }` | 201, área creada. | 422 INVALID_REFERENCE; 409 DUPLICATE_CODE. |
| PATCH `/api/v1/curriculum/academic-areas/:id` | `{ name, expectedVersion, technicalReason }` | 200, área actualizada. | 404; 409 STALE_VERSION. |
| POST `/api/v1/curriculum/disciplines` | `{ planTypeId, academicAreaId: UUID o null, code, officialName, technicalReason }` | 201, disciplina creada. | 422 INVALID_REFERENCE / AREA_PLAN_MISMATCH; 409 DUPLICATE_CODE. |
| PATCH `/api/v1/curriculum/disciplines/:id` | `{ officialName?, academicAreaId?, expectedVersion, technicalReason }` | 200, disciplina actualizada. | 404; 422 AREA_PLAN_MISMATCH; 409 STALE_VERSION / HISTORICAL_REFERENCE_CONFLICT. |

PATCH exige al menos un campo editable. No permite modificar códigos, planTypeId ni UUID. Omitir academicAreaId conserva su valor; enviar null es explícito. Completar un área desconocida del mismo plan conserva UUID y se audita. Reasignar/vaciar un área que reinterpretaría una clasificación utilizada se rechaza. Corregir un nombre no permite convertir el registro en otra disciplina. Se verifican las referencias históricas efectivamente implementadas, incluidas correspondencias; no se requiere implementar Curriculum para comprobarlas. No hay DELETE, traslado masivo ni endpoint de carga de mallas.

### Correspondencias institucionales

Base `B = /api/v1/institutions/:institutionId/subjects/:subjectId/curriculum-mappings`.

| Método y ruta | Permiso / scope | Request | Response | Errores específicos |
|---|---|---|---|---|
| GET B | `subject-curriculum-mapping.read`; institución o lectura de curso/asignación autorizada | Query `btiYear?`, `status=current\|retired\|all` (default current), `courseId?`, paginación. | 200, lista permitida; sin correspondencia devuelve []. | 400 filtros inválidos/contexto BTI ausente; 403 permiso; 404 recurso no visible. |
| POST B | `subject-curriculum-mapping.manage`; institución completa | Body `{ btiYear, curriculumDisciplineId }`. | 201, correspondencia vigente. | 409 CURRENT_MAPPING_EXISTS / RESOURCE_INACTIVE; 422 INVALID_BTI_YEAR / INVALID_REFERENCE. |
| POST B`/:mappingId/retire` | Mismo permiso y ámbito de escritura | Body `{ expectedVersion }`. | 200, correspondencia retirada. | 404; 409 STALE_VERSION. |
| POST B`/:mappingId/replace` | Mismo permiso y ámbito de escritura | Body `{ curriculumDisciplineId, expectedVersion }`. | 201, `data: { retiredMapping, currentMapping }`. | 404; 409 STALE_VERSION / MAPPING_RETIRED / CURRENT_MAPPING_EXISTS / RESOURCE_INACTIVE; 422 INVALID_REFERENCE / NO_CHANGE. |

La proyección del checkpoint es `{ id, subjectId, btiYear, curriculumDisciplineId, discipline: { officialName, planType: { id, name }, academicArea: { id, name } o null }, retiredAt, rowVersion }`. No expone cadenas de delegación ni relaciones inversas de otras instituciones. Los UUID se usan en API privada; esto no cambia D-06 ni la consulta pública.

No hay PATCH de identidad de correspondencia. Sustituir conserva subjectId/btiYear y crea otro UUID. Cambiar el nivel requiere una operación distinta de creación, no reasignar historia.

### Autorización, concurrencia e historia

1. Comprobar sesión, cuenta/docente activos y concesiones efectivas; permiso y scope pertenecen a la misma concesión. Revalidar al escribir, incluyendo revocaciones concurrentes.
2. Resolver institución real de Subject en PostgreSQL; verificar su coincidencia con la ruta. mappingId debe pertenecer al Subject indicado. Un UUID compartido o adivinado no concede acceso. Denegar recursos ajenos con 404 RESOURCE_NOT_FOUND uniforme; falta de permiso sobre contexto visible con 403 PERMISSION_DENIED. No se cambian las respuestas 403 del Hito 1.
3. Un lector limitado a cursos debe enviar courseId; se verifica institución, materia utilizada por asignación autorizada y Course.btiYear. El filtro efectivo queda restringido a ese nivel. Un docente debe poseer además su TeachingAssignment vigente. Un btiYear solicitado diferente se rechaza; sin btiYear del curso no se devuelve todo el historial institucional.
4. La lectura histórica puede incluir correspondencias retiradas solo dentro de ese contexto autorizado. Usuarios con lectura institucional pueden consultar niveles/historia de su materia. La inactividad no elimina lectura histórica autorizada; no restaura acceso docente perdido por retiro de asignación.
5. Crear/sustituir requiere Subject e Institution activos. Retirar es una operación de cierre histórico permitida al administrador autorizado aun si están inactivos; no crea vínculos nuevos.
6. La creación verifica la disciplina existente, no la existencia de una malla. El área puede ser null. AcademicYear y btiYear no son intercambiables.
7. Retiro y sustitución usan rowVersion/expectedVersion con actualización condicional o bloqueo transaccional. Un retiro repetido con versión vigente devuelve el estado sin duplicar auditoría de cambio; una versión anterior devuelve 409.
8. Sustituir bloquea/verifica la fila vigente, la retira, crea la nueva y audita en una única transacción. Un error revierte todo; nunca deja la anterior retirada sin reemplazo. No se reutilizan filas retiradas ni se modifican subjectId/btiYear/discipline de la anterior.
9. El índice único parcial es la garantía final contra carreras. Traducir violaciones conocidas a 409 CURRENT_MAPPING_EXISTS; no exponer SQL/Prisma. Conflictos serializables utilizan reintentos acotados del proyecto; agotados, 409 CONCURRENT_MODIFICATION, sin escritura parcial.
10. Mutaciones exitosas y auditoría son atómicas; rechazos relevantes se auditan fuera del rollback, sin secretos. Completar área, crear, retirar y sustituir conservan actor, objetivo, contexto, antes/después y razón técnica cuando corresponde. No se borran relaciones históricas.

### Códigos HTTP y errores del módulo

| HTTP | Código | Uso |
|---|---|---|
| 400 | VALIDATION_ERROR | Contrato inválido, UUID, claves desconocidas, cursor/filtros o contexto BTI ausente. |
| 401 | AUTHENTICATION_REQUIRED | Sesión ausente, inválida, revocada o expirada; existente. |
| 403 | PERMISSION_DENIED | Permiso/scope insuficiente o administración compartida ordinaria. |
| 403 | CSRF_TOKEN_INVALID | CSRF inválido; existente. |
| 403 | DELEGATION_DENIED | Intento de delegar administración compartida por la vía institucional. |
| 400 | RESOURCE_SET_NOT_SUPPORTED | Ámbito aún no implementado; se conserva. |
| 404 | RESOURCE_NOT_FOUND | Objetivo inexistente o no visible; respuesta uniforme. |
| 409 | DUPLICATE_CODE | Unicidad de code según catálogo y plan. |
| 409 | CURRENT_MAPPING_EXISTS | Segunda correspondencia vigente para materia/nivel. |
| 409 | STALE_VERSION | Versión desactualizada. |
| 409 | MAPPING_RETIRED | Sustitución de una fila retirada. |
| 409 | HISTORICAL_REFERENCE_CONFLICT | Reinterpretación de clasificación usada. |
| 409 | RESOURCE_INACTIVE | Creación/vinculación nueva en contexto inactivo. |
| 409 | CONCURRENT_MODIFICATION | Reintentos transaccionales agotados. |
| 422 | INVALID_BTI_YEAR | Entero fuera de 1–3 en correspondencias. |
| 422 | AREA_PLAN_MISMATCH | Área existente de otro tipo de plan. |
| 422 | INVALID_REFERENCE | FK de referencia inexistente en una escritura, tras autorización. |
| 422 | NO_CHANGE | Reemplazo por la misma disciplina. |

Estos códigos específicos pertenecen a las nuevas rutas; los errores CONFLICT/VALIDATION_ERROR de rutas académicas existentes permanecen intactos. Fallos inesperados usan el manejador común sin filtrar detalles internos.

### curriculumAvailability: contrato futuro, no implementado en este checkpoint

El campo `curriculumAvailability` se reserva para la futura integración real con mallas. **Se omite en las respuestas de este checkpoint**; ausencia significa “disponibilidad aún no consultable”, no NOT_AVAILABLE. Los consumidores deben tolerar esa ausencia. No se consultan tablas/modelos inexistentes, no se crean filas Curriculum vacías, mocks productivos ni datos sintéticos para completar la respuesta.

Cuando exista el módulo y su fuente real, los valores contractuales serán NOT_AVAILABLE o VALIDATED_AVAILABLE para la disciplina y btiYear exactos, dentro de las mallas comprometidas. NOT_AVAILABLE exige poder comprobar ausencia real; VALIDATED_AVAILABLE exige malla confirmada. No se deduce disponibilidad a partir del nombre, del área completa ni de la existencia de una correspondencia. Tampoco se selecciona automáticamente una versión para planes históricos.

La clasificación parcial del catálogo sigue siendo comprobable ahora. La carga V1.0 continúa limitada a Matemática Aplicada a la Informática y Algorítmica, 1.º–3.º BTI; Dibujo Técnico y Diseño Gráfico no exigen malla completa.

### UX aprobada y compatibilidad

Navegación: **Inicio → Institución → Curso → Materia → espacio de trabajo**. Dentro de la materia: Tareas y Evaluaciones, Asistencia, Anecdótico, Conducta, Proceso, Perfiles de Alumnos, Planificación y Currículo, conforme se implementen sus módulos. Esta decisión de navegación no exige construir ahora pantallas de módulos futuros. Proceso no se redefine como avance curricular. Conducta sustituye cualquier etiqueta de comportamiento “Disciplina”.

Crear Subject no obliga a elegir referencia. En detalle/edición, “Referencia curricular” permite consultar/asociar/sustituir/retirar según permisos, con confirmación para retiro/sustitución y aviso de conservación histórica. Desde curso se usa su btiYear; desde administración institucional se elige 1–3. Sin ese dato del curso, informar la limitación sin bloquear las operaciones académicas del Hito 1.

Estados de UX:

- Sin correspondencia vigente: **Sin referencia curricular**.
- Con correspondencia en este checkpoint: mostrar referencia y **Disponibilidad de malla aún no consultable**; no afirmar que está cargada ni que no existe.
- Integración futura con NOT_AVAILABLE comprobado: **Referencia curricular asociada, pero sin malla V1.0**.
- Integración futura con VALIDATED_AVAILABLE comprobado: **Referencia con malla validada disponible**.

El área desconocida muestra “Área académica aún no validada”, nunca una opción ficticia “Pendiente”. Se puede seleccionar una disciplina sin área dentro de su plan. El nombre institucional permanece en la navegación y el oficial en la referencia.

Los controles usan los permisos aprobados y el mecanismo de comprobación existente; ocultarlos no reemplaza la autorización. No se ofrece crear áreas/disciplinas desde la administración institucional cotidiana. No se añade una pantalla cotidiana para cuenta técnica. Las materias sin correspondencia siguen apareciendo en listados/asignaciones; evitar consultas que las eliminen mediante joins obligatorios.
