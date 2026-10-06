# Pruebas técnicas y de persistencia

## Matriz prevista — Hito 2B Tareas, Evaluaciones y Proceso (06/10/2026)

**Estado: aprobada documentalmente; ninguna prueba B-01 a B-27 se ha ejecutado todavía.** Los IDs son identificadores de prueba, no RF/RNF nuevos. `2B-1` = banco, tarea, evaluación, resultado, Proceso sin nota; `2B-2` = escala, conversión/redondeo, cambios confirmados y nota. Contratos completos en [API.md](../architecture/API.md), decisión [ACAD-2B-01](../architecture/DECISIONS.md). Ejecutar en PostgreSQL real los casos de integridad/concurrencia; no contabilizar suites que omitan DB.

| Caso | Checkpoint / nivel | Subcasos y resultado verificable |
|---|---|---|
| B-01 | 2B-1 DB/API | Crear Task ORDINARIA con máximo decimal >=0 en asignación propia; aparece una vez en Proceso y suma máximo a D, incluso cuando aún no tiene resultado. |
| B-02 | 2B-1 DB/API | Task/Assessment FUERA_DE_ESCALA suma puntos EVALUADO al numerador X pero su máximo no aumenta D; pendientes se cuentan. |
| B-03 | 2B-1 DB/API | Assessment independiente se crea sin Task ni banco; exige máximo/tipo propios, registra resultado y cuenta una sola vez. |
| B-04 | 2B-1 DB/API | Assessment vinculada exige Task de la misma asignación, usa máximo/tipo heredados y UNIQUE(taskId); no duplica actividad, denominador o resultado. |
| B-05 | 2B-1 DB/API | Task sin Assessment es elegible y pendiente; primer resultado crea Assessment vinculada y su resultado atómicamente; ausencia de fila se muestra como pendiente y no introduce cero. Dos primeros resultados concurrentes dejan una Assessment vinculada. |
| B-06 | 2B-1 DB/API | Diferenciar PENDIENTE (puntos/fecha/actor NULL), ausencia de fila y EVALUADO con `earnedPoints="0"`; validar CHECK y que extras pendientes también bloquean nota en 2B-2. |
| B-07 | 2B-1 cálculo; 2B-2 formal | Con D=20, O=20 y X=3, T=23 y porcentaje=115%; en 2B-1 nota nula; con escala completa y sin pendientes en 2B-2 nota máxima configurada, nunca superior tras redondeo. |
| B-08 | 2B-1 cálculo; 2B-2 formal | D=0 con y sin extras: porcentaje nulo, sin división por cero; formalGrade nula aunque haya escala. Pendientes con D>0: porcentaje numérico etiquetado parcial y formalGrade nula; al evaluar último pendiente se recalcula y puede emitirse nota solo con escala válida. |
| B-09 | 2B-2 schema/unit/API | Validar dos escalas institucionales ilustrativas diferentes, sin constantes de producto; JSON Schema v1 PERCENTAGE_BANDS/rounding NONE o DECIMAL_PLACES, orden/bordes/banda desde 0 y >100; rechazo de propiedades/versión/tipo extraños, intervalos vacíos o repetidos, límites incoherentes, grades fuera de rango, más de 256 bandas/16 KiB, precisión excesiva, redondeos HALF_UP/HALF_EVEN/TOWARD_ZERO y `places` fuera de 0..6. |
| B-10 | 2B-1 DB/API concurrente | UNIQUE(assessmentId,enrollmentId) impide segundo resultado; dos altas/escrituras simultáneas con `expectedVersion` nulo o anterior dejan un solo valor ganador, conflicto 409 de la perdedora, sin auditoría de éxito huérfana. |
| B-11 | 2B-1 DB/API | Resultado para Enrollment de curso o año ajeno, o estudiante inactivo en nueva captura, falla; usar transacción/FK contextual, no confiar en UUID de ruta. Historia previa sigue consultable con permiso. |
| B-12 | 2B-1 DB/API concurrente | Capturar primer resultado por Task sin Assessment: ambas peticiones intentan crear vínculo 1:0..1; UNIQUE(taskId) y transacción resuelven la carrera, sin evaluaciones duplicadas ni notas duplicadas. |
| B-13 | 2B-1 seguridad | Banco solo para `ownerTeacherId` activo con permiso/scope; docente distinto y administrador institucional con permiso genérico no consultan/alteran plantillas ajenas. Listas, búsqueda y errores no filtran títulos. |
| B-14 | 2B-1 DB/API | Copiar banco o Task/Assessment entre asignaciones propias autorizadas guarda origen opcional y contenido independiente; editar origen no cambia copia; nunca se copian Enrollment, resultados ni permisos de banco. |
| B-15 | 2B-1 DB/API seguridad | Reutilización desde banco ajeno, Task ajena o destino sin asignación propia vigente devuelve 404/403 contextual; Assessment y Task de asignaciones distintas no se pueden vincular. |
| B-16 | 2B-1 bloqueo; 2B-2 DB/API | 2B-1 impide cambio de máximo con resultados y no expone preview falsa. En 2B-2 cambio sin resultados comprueba versión/ausencia en transacción; con resultados devuelve advertencia, exige token, cancelar no escribe. Escala cambia solo tras preview. |
| B-17 | 2B-2 DB/API/auditoría | Reducir máximo con puntos históricos mayores requiere confirmación: conserva `earnedPoints`, advierte sobrepaso, recalcula derivados, incrementa versión y audita antes/nuevo/efecto en la misma transacción; nueva captura por encima del máximo vigente falla. |
| B-18 | 2B-2 seguridad/concurrencia | Token HMAC: firma alterada/malformado, otro actor o sesión, recurso/purpose/cambio diferente, TTL >5 min, permiso revocado, `kid` desconocido, replay tras éxito, resultados/matrículas/actividades/escalas cambiados desde preview, dos instancias con clave compartida y rotación de clave dentro del TTL. Errores 400/409/403 según contrato, sin escritura parcial. |
| B-19 | 2B-1/2B-2 DB/API | No cambiar scoringKind ni asociación de Assessment con resultados; vincular solo si Task libre/misma asignación y evaluación sin resultados. Máximo de vinculada se modifica exclusivamente por Task en 2B-2; controlar versión. |
| B-20 | 2B-1 DB/API seguridad | Docente/usuario/TeachingAssignment finalizados o institución/curso inactivos bloquean nuevas capturas; se preservan y consultan resultados históricos con autorización; Student/matrícula no se reescriben. |
| B-21 | 2B-2 DB/API | Versión de escala usada queda inmutable; nueva versión conserva configuración vieja, UNIQUE(institución,nombre,versión), cambio de FK exige `grading-scale.read` + `teaching-assignment.manage`, preview/token, institución compatible y auditoría. Pendientes o D=0 no generan nota aun después del cambio. |
| B-22 | 2B-1/2B-2 seguridad HTTP | Cada permiso `.read` y `.manage` separado, sesión/CSRF/scope efectivo, asignación propia, 404 uniforme para ID ajeno; administrador de otra institución o rol docente sin permisos no accede. Sin grants demo automáticos; pruebas nuevas de escala en 2B-2. |
| B-23 | 2B-1 RTL/E2E; 2B-2 RTL | Materia → Tareas y Evaluaciones: tarea/Assessment independiente o vinculada, máximo/tipo, banco privado y reutilización; capturar cero y ver pendientes; 2B-2 muestra advertencias y confirmación/cancelación del máximo sin mutar puntos. |
| B-24 | 2B-1 RTL/E2E; 2B-2 RTL/E2E | Materia → Proceso usa Enrollment real, actividades únicas, D/O/X/T y porcentaje parcial; en 2B-1 nunca muestra nota formal; en 2B-2 solo con D>0, sin pendientes y escala válida, y refleja cambios confirmados de máximo/escala. |
| B-25 | 2B-1 y 2B-2 regresión real | Hito 1: administrador → institución → docente → curso → materia → asignación → login docente → asignaciones propias; permisos y scopes previos no se amplían. |
| B-26 | 2B-1 y 2B-2 regresión real | Catálogo/correspondencias curriculares: Subject institucional opcionalmente vinculado, permisos y aislamiento intactos; no se cargan mallas por introducir Task o escala. |
| B-27 | 2B-1 y 2B-2 regresión real | Student/Enrollment de 2A, cédula única/contexto, curso → Estudiantes y Materia → Perfiles de Alumnos intactos; resultado solo para matrícula compatible y sin fuga de otras instituciones. |

**Subcasos contractuales obligatorios:** en B-08 y B-24, ausencia de resultado y `PENDIENTE` provocan `isPartial=true`, `formalGrade=null` aunque exista escala; completar la última actividad elegible recalcula. En B-09 se prueban `NONE`, `DECIMAL_PLACES` y definición incompleta sin emitir nota. En B-16–B-18 y B-21 se ensayan token ligado a actor/sesión/recurso/versiones/valores/contextDigest, caducidad de cinco minutos, snapshots cambiantes, confirmación repetida, respuesta genérica y `AuditLog` transaccional; no hay almacenamiento en memoria por instancia. En B-10/B-12, usar carreras reales PostgreSQL. Registrar casos aprobados, fallidos y omitidos por checkpoint; repetir Hito 1/currículo/2A con la base/migraciones nuevas y E2E real. Ningún resultado histórico de Hito 2A equivale a ejecución de esta matriz.

## Matriz ejecutada — Hito 2A Student + Enrollment (05/10/2026)

**Estado: ejecutado en PostgreSQL desechable, Vitest/Supertest, RTL y Playwright real.** No sumar estos casos a las cifras históricas de Hito 1 o currículo. Los identificadores `STU-*` son claves de pruebas, no nuevos RF/RNF. API.md define los contratos y DECISIONS.md la decisión STU-ENR-01.

| Caso | Nivel | Verificación y resultado esperado |
|---|---|---|
| STU-01 | DB/API | Alta con cédula crea Student UUID y Enrollment UUID distintos, año del curso y respuesta contextual; auditoría en la misma transacción. |
| STU-02 | DB/API | Alta sin cédula guarda `nationalId` y `nationalIdNormalized` en NULL; dos estudiantes sin cédula no colisionan por ese índice. |
| STU-03 | Unit/DB | Normalización determinista: formatos equivalentes producen la misma clave y se conservan ceros iniciales; nunca generar valor ficticio. |
| STU-04 | DB/API | Segunda cédula normalizada devuelve 409 CONFLICT y ninguna fila nueva, sin exponer otra identidad. |
| STU-05 | Concurrencia DB/API | Dos altas simultáneas de la misma cédula dejan una sola identidad y primera matrícula; la otra petición recibe conflicto genérico; ninguna auditoría de éxito huérfana. |
| STU-06 | DB/API | Corregir nombre, incorporar/quitar/corregir cédula con `expectedVersion` conserva Student UUID y las matrículas; versión vieja: 409 STALE_VERSION. |
| STU-07 | DB/API | Desactivar/reactivar Student preserva UUID y matrículas; inactivo es legible históricamente con autorización y no admite nueva matrícula; reactivar no concede permisos ni cambia estados de otras entidades. |
| STU-08 | DB/API | Matrícula válida de identidad ya visible reutiliza Student UUID y enlaza Course + AcademicYear correctos. |
| STU-09 | DB/API | Misma terna Student/Course/AcademicYear dos veces devuelve 409 y deja una sola fila. |
| STU-10 | Concurrencia DB/API | Dos matrículas idénticas simultáneas dejan una fila, una creación y un conflicto; rollback completo en la perdedora. |
| STU-11 | DB/API | academicYearId diferente del de Course devuelve 422 INVALID_REFERENCE; verificar FK compuesta y ausencia de fila, incluyendo una solicitud que omita controles frontend. |
| STU-12 | DB/API | Student, Course o Institution inactivo impide vínculo nuevo; desactivación no reescribe matrículas existentes. |
| STU-13 | Seguridad HTTP | Administrador de A intenta usar IDs de Student/Enrollment/Course de B en lista, detalle, historial, alta o PATCH: ninguna matrícula ni contexto ajeno se devuelve; 404 uniforme cuando el recurso no es visible. |
| STU-14 | Seguridad HTTP | Docente con `student.read` + `enrollment.read` efectivos y TeachingAssignment propia vigente ve únicamente matriculados de su curso. Rol docente o asignación sin permisos no basta. |
| STU-15 | Seguridad HTTP | Docente consulta curso ajeno o asignación ajena/finalizada: denegado; variar institutionId/courseId de ruta y filtros no amplía el acceso. |
| STU-16 | Seguridad HTTP | Student con matrículas en A y B conserva una identidad; admin de A ve datos básicos y solo filas de A. B no aparece en historia, búsquedas, nómina, cursor, totales ni errores. |
| STU-17 | Seguridad/concurrencia | PATCH global de Student compartido sin `student.manage` sobre todos los contextos: 403 PERMISSION_DENIED genérico sin identificar instituciones, cursos, matrículas ni cantidad. Matrícula concurrente no puede invalidar comprobación de autorización. |
| STU-18 | Seguridad HTTP | La cédula ya existe solo fuera del ámbito visible: búsqueda devuelve vacío indistinguible de inexistencia; alta devuelve 409 CONFLICT genérico sin `studentId`/institución/matrícula; no hay duplicado, fusión ni reclamación automática. |
| STU-19 | API | Listado de curso muestra cada Enrollment con Student correcto, año y `isActive`; paginación/cursor estables, reautorizados y sin fugas. |
| STU-20 | API | Historial devuelve solo matrículas autorizadas; contexto de curso obligatorio para acceso limitado/docente; ID global de Student no concede acceso a otros contextos. |
| STU-21 | Seguridad/API | 401 sin sesión, 403 por CSRF/permisos y 400 por payload inválido/claves desconocidas; cuerpos preservan `error.code`, `error.message`, `error.requestId`, sin trazas ni datos ajenos. |
| STU-22 | Integridad DB | FK restrictivas y ausencia de endpoints destructivos impiden borrar o reasignar historia; una corrección de nombre/cédula no modifica Student/Enrollment UUID ni claves de contexto. |
| STU-23 | RTL | Curso → Estudiantes: búsqueda previa, alta o selección, cédula opcional, año/curso confirmados, estudiante inactivo y conflicto sin información externa; acciones según permisos. |
| STU-24 | RTL/E2E real | Materia → Perfiles de Alumnos usa la misma identidad/matrícula contextual y TeachingAssignment vigente; no inventa tareas, notas, asistencia ni perfil integral. |
| STU-25 | Regresión real | Recorrido Hito 1 completo: administrador → institución → docente → curso → materia → asignación → login docente → consulta propia 200/ajena denegada. |
| STU-26 | Regresión real | Catálogo/correspondencias curriculares, aislamiento y referencia opcional de Subject; 17 permisos existentes conservados, nuevos cuatro no concedidos al demo automáticamente. |

Antes de migrar, comprobar qué constraints SQL de Course–AcademicYear–Institution ya existen y probar el caso de institución cruzada. Verificar el esquema Prisma y la migración nueva Student + Enrollment, índices/UNIQUE/CHECK, relaciones y `ON DELETE RESTRICT`; no asumir que lo documentado ya está en base. Registrar resultados efectivamente ejecutados por grupo, junto con typecheck/build y suites ordinaria, DB y E2E. `RUN_DATABASE_TESTS=1` es necesario para afirmar cobertura PostgreSQL; no contabilizar pruebas omitidas como aprobadas.

El cierre de Hito 2A **no** depende de pruebas para importación CSV/XLSX, consulta pública por cédula, tareas, banco, evaluaciones, calificaciones, asistencia, seguimiento, planificación, mallas o IA. RF-034 solo recibe identidad y matrícula; las demás fuentes se ensayarán en sus checkpoints correspondientes.

### Ejecución Hito 2A del 05/10/2026

Se creó la base desechable `edugestor_hito2a_final_20261005` para validar la migración final desde cero. `prisma validate` y `prisma generate` aprobaron; `migrate deploy` aplicó las seis migraciones en base vacía; `migrate status` confirmó esquema al día. Se comprobó en PostgreSQL que `Course_academic_year_institution_fkey` ya existía, que `Enrollment_course_year_fkey`, `Student_nationalId_pair_check` y `Student_active_state_check` quedaron instaladas y que se crearon los índices de Student/Enrollment. Se probó el rechazo de Course con año de otra institución y Enrollment con año incompatible.

| Caso | Resultado ejecutado | Evidencia |
|---|---|---|
| STU-01 | Aprobado | Supertest + PostgreSQL: alta, UUID, año y auditoría. |
| STU-02 | Aprobado | PostgreSQL: dos cédulas NULL sin colisión. |
| STU-03 | Aprobado | Normalización determinista y ceros iniciales. |
| STU-04 | Aprobado | Conflicto 409 de cédula sin fila nueva. |
| STU-05 | Aprobado | Dos altas concurrentes: 201/409, una identidad. |
| STU-06 | Aprobado | Corrección, incorporación/retiro de cédula y dos PATCH concurrentes con STALE_VERSION. |
| STU-07 | Aprobado | Desactivar/reactivar, lectura histórica y bloqueo de nueva matrícula. |
| STU-08 | Aprobado | Reutilización de Student visible en segundo curso. |
| STU-09 | Aprobado | Matrícula duplicada 409. |
| STU-10 | Aprobado | Matrículas concurrentes 201/409, una fila. |
| STU-11 | Aprobado | Año discordante 422, FK compuesta y cruce Course/institución rechazado. |
| STU-12 | Aprobado | Student, Course e Institution inactivos bloquean vínculo. |
| STU-13 | Aprobado | IDs de B en rutas de A: 404 y sin contexto ajeno. |
| STU-14 | Aprobado | Docente con permisos y asignación propia; asignación sin permisos rechazada. |
| STU-15 | Aprobado | Curso ajeno y asignación finalizada rechazados. |
| STU-16 | Aprobado | Student compartido: historia de A no muestra B. |
| STU-17 | Aprobado | PATCH global denegado genéricamente; matrícula concurrente serializada. |
| STU-18 | Aprobado | Búsqueda de cédula externa vacía y alta 409 opaco. |
| STU-19 | Aprobado | Nómina paginada y cursor reautorizado después de revocación. |
| STU-20 | Aprobado | Historial contextual y `courseId` obligatorio al docente. |
| STU-21 | Aprobado | Sesión, CSRF, campos extra y error con requestId. |
| STU-22 | Aprobado | Trigger impide UPDATE/DELETE de Enrollment. |
| STU-23 | Aprobado | RTL y Playwright real: búsqueda, alta y reutilización. |
| STU-24 | Aprobado | RTL y Playwright real: perfil contextual desde asignación. |
| STU-25 | Aprobado | Playwright real Hito 1: recorrido y 200/403 docente. |
| STU-26 | Aprobado | Playwright real currículo y pruebas de catálogo/demo. |

Resultados exactos de suites: API con `RUN_DATABASE_TESTS=1`: **14 archivos, 89/89 pruebas aprobadas**. Suite ordinaria: shared **1/1**, API **13/13** con **76 DB omitidas por diseño**, web **12/12**. Typecheck de shared/API/web aprobado; build de API y web aprobado (Vite: 105 módulos). E2E simulado **1/1**; E2E real **3/3** contra React, Express y PostgreSQL aislados. El binario `npm` no estaba disponible en el host de ejecución; se invocaron los binarios locales equivalentes de Prisma, TypeScript, Vitest, Vite y Playwright.

La sincronización del catálogo se ejecutó dos veces seguidas sobre la base final y devolvió **21 permisos** en ambas, sin concesiones nuevas al demo.

Incidencias resueltas durante la ejecución: se eliminó una cédula fija en las pruebas que colisionaba entre corridas; se precisó el selector Playwright de “Matricular”; y se reprovisionaron las credenciales ficticias del demo después de la suite de bootstrap, que actualiza la cuenta demo en la misma base desechable. La repetición final de E2E real aprobó los tres recorridos.

La infraestructura configura:

- Vitest para los tres workspaces.
- React Testing Library para el frontend.
- Supertest para la API.
- Playwright para futuras pruebas E2E y una comprobación mínima del bootstrap.

Las pruebas ordinarias verifican el contrato compartido de salud, la respuesta disponible/degradada de `GET /health`, request ID, errores uniformes, cabeceras Helmet, configuración CORS, hashing de contraseña y el renderizado inicial del frontend.

Comando principal:

```bash
npm test
```

## Ejecución del 22/09/2026

- Instalación npm: 337 paquetes auditados, 0 vulnerabilidades tras actualizar el toolchain.
- TypeScript: los tres workspaces compilaron sin errores.
- Vitest: 3 archivos y 4 pruebas aprobadas.
- Frontend: build de Vite aprobado.
- Prisma: generación del cliente y validación del esquema aprobadas.
- Docker Compose: configuración válida; `web`, `api` y `postgres` iniciados.
- PostgreSQL: `pg_isready` y `SELECT 1` aprobados; 0 tablas en el esquema `public`.
- `GET /health`: HTTP 200 con estado `ok` y base de datos `available`.
- Frontend contenedorizado: HTTP 200.

Playwright queda configurado para los recorridos E2E posteriores. Su prueba de navegador no se ejecutó en este bootstrap porque no se instalaron binarios de navegador como parte de esta tarea.

## Ejecución del 24/09/2026 — checkpoint de persistencia Hito 1

Base aislada: `edugestor_hito1_20260924`, creada vacía en PostgreSQL 17 de Docker.

| Verificación | Comando / mecanismo | Resultado |
|---|---|---|
| Schema Prisma | `npm run prisma:validate -w @edugestor/api` | Aprobado |
| Prisma Client | `npm run prisma:generate -w @edugestor/api` | Aprobado |
| Migración vacía | `npm run prisma:migrate:deploy -w @edugestor/api` | 1 migración aplicada |
| Estado migración | `prisma migrate status` | Esquema al día |
| Integración PostgreSQL | `RUN_DATABASE_TESTS=1 npm test -w @edugestor/api` | 4 archivos, 7 pruebas aprobadas |
| Suite ordinaria | `npm test` | Shared 1, API 5 y Web 1 aprobadas; las 2 de DB se omiten por defecto |
| TypeScript | `npm run typecheck` | 3 workspaces aprobados |
| Builds | `npm run build` | Shared, API y Vite aprobados |
| Bootstrap idempotente | dos ejecuciones de `bootstrap:root` | crea una vez; segunda ejecución no duplica |
| API compilada | `GET /health` en puerto de prueba | HTTP 200; DB disponible; request ID, CORS y Helmet correctos |
| Docker Compose | rebuild de `api`, `compose ps`, `/health` | API y PostgreSQL saludables |

Las pruebas de integración cubren creación coherente de institución/año/curso/materia/docente/asignación; rechazo de cruces entre instituciones; año lectivo inválido; segundo año actual; duplicación de concesión activa; ámbito de cursos inconsistente; bloqueo de `RESOURCE_SET`; e inmutabilidad de `AuditLog`.

Para ejecutar las pruebas de DB debe usarse una base desechable ya migrada y definir explícitamente:

```powershell
$env:RUN_DATABASE_TESTS='1'
$env:DATABASE_URL='postgresql://usuario:clave@localhost:5432/base_desechable?schema=public'
npm run test -w @edugestor/api
```

No se ejecutó Playwright en este checkpoint; no forma parte de la persistencia ni de las fundaciones backend solicitadas.

## Ejecución del 24/09/2026 — autenticación y sesiones Hito 1

Base final aislada: `edugestor_auth_race_20260924`, creada vacía en PostgreSQL 17 y migrada con las dos migraciones versionadas. La corrida final incluye el refuerzo serializable contra carreras entre login y desactivación.

| Verificación | Resultado |
|---|---|
| `npm run prisma:validate -w @edugestor/api` | Aprobado |
| `npm run prisma:generate -w @edugestor/api` | Aprobado |
| Migración desde base vacía | 2 migraciones aplicadas |
| Integración con `RUN_DATABASE_TESTS=1` | 6 archivos, 20/20 pruebas aprobadas |
| `npm run typecheck` | Shared, API y Web aprobados |
| `npm run build` | Shared, API y Vite aprobados |
| `npm test` | Shared 1, API 9 y Web 1 aprobadas; 11 integraciones DB omitidas por defecto |

Cobertura de autenticación ejecutada contra PostgreSQL real:

- Login válido, contraseña incorrecta, usuario inexistente y cuenta desactivada con respuesta uniforme.
- Emisión de cookie HttpOnly/SameSite y comprobación unitaria de `Secure` en producción.
- Token opaco aleatorio y persistencia exclusiva de su hash.
- Sesión válida, expirada, revocada y actualización de `lastSeenAt` sin modificar la expiración absoluta.
- Logout con revocación y limpieza de cookies.
- Rechazo de recurso privado sin sesión y de logout autenticado sin CSRF.
- Revocación de todas las sesiones por desactivación directa de `User` y `Teacher`; rechazo de login docente posterior.
- Rate limiting de login con secuencia `401, 401, 429` para el límite de prueba.
- Inspección de respuestas, auditoría y logs para verificar ausencia de contraseña, `passwordHash` y token opaco.

El primer intento final de `prisma generate` encontró `EPERM` porque un proceso Node antiguo del propio repositorio mantenía cargado el DLL de Prisma. Se identificó ese proceso por el módulo abierto, se detuvo únicamente ese PID y la repetición aprobó. No queda un defecto de código asociado.

## Ejecución del 25/09/2026 — autorización jerárquica Hito 1

Base aislada: `edugestor_authorization_test`, creada vacía en PostgreSQL 17 de Docker y migrada con las cuatro migraciones versionadas.

| Verificación | Resultado |
|---|---|
| `npm run prisma:validate` | Aprobado |
| `npm run prisma:generate` | Aprobado |
| Migración desde base vacía | 4 migraciones aplicadas |
| `prisma migrate status` | Esquema al día |
| Integración con `RUN_DATABASE_TESTS=1` | 7 archivos, 36/36 pruebas aprobadas |
| `npm run typecheck` | Shared, API y Web aprobados |
| `npm run build` | Shared, API y Vite aprobados |
| `npm test` | Shared 1, API 9 y Web 1 aprobadas; 27 pruebas PostgreSQL omitidas por defecto |
| Catálogo idempotente | 2 ejecuciones, 13 permisos sincronizados sin duplicación |
| `docker compose config --quiet` | Aprobado |

Cobertura de autorización ejecutada contra PostgreSQL real:

1. Permiso y scope correctos: permitido.
2. Permiso correcto y scope incorrecto: rechazado.
3. Scope correcto y permiso incorrecto: rechazado.
4. Permiso de una concesión y scope de otra: rechazado.
5. Administrador institucional dentro de su institución: permitido.
6. Administrador limitado a curso fuera de ámbito: rechazado.
7. Delegación hacia scope menor con `parentGrantId`: permitida.
8. Delegación de permiso superior: rechazada y auditada.
9. Delegación de scope superior: rechazada y auditada.
10. Autoelevación: rechazada y auditada.
11. Intento de formar un ciclo alterando la procedencia: rechazado por inmutabilidad SQL.
12. Concesión revocada y descendientes: dejan de autorizar y quedan revocados cuando corresponde.
13. Usuario con varios roles: no acumula permiso y scope de concesiones distintas.
14. Docente A frente a asignación de Docente B: rechazado tanto en servicio como en API.
15. Auditoría de éxitos y rechazos: presente y sin contraseñas, hashes, cookies ni tokens.

También se verificaron el rechazo explícito de `RESOURCE_SET`, el middleware `requirePermission`, la resolución de recursos desde la base y la ruta de comprobación de asignación docente propia.

Durante la ejecución se corrigieron dos errores antes de la corrida final: un alias SQL reservado y la revalidación innecesaria del padre al actualizar únicamente `revokedAt`. La segunda condición quedó corregida mediante una migración adicional y volvió a probarse desde base vacía.

## Ejecución del 25/09/2026 — núcleo institucional y académico Hito 1

Base aislada: `edugestor_academic_test`, creada vacía en PostgreSQL 17 de Docker y migrada con las cuatro migraciones versionadas existentes.

| Verificación | Resultado |
|---|---|
| `npm run prisma:validate` | Aprobado |
| `npm run prisma:generate` | Aprobado |
| Migración desde base vacía | 4 migraciones aplicadas |
| `prisma migrate status` | Base de desarrollo al día |
| Integración con `RUN_DATABASE_TESTS=1` | 9 archivos, 56/56 pruebas aprobadas |
| `npm run typecheck` | Shared, API y Web aprobados |
| `npm run build` | Shared, API y Vite aprobados |
| `npm test` | Shared 1, API 11 y Web 1 aprobadas; 45 integraciones omitidas por defecto |

Casos nuevos ejecutados contra PostgreSQL real:

1. Creación institucional mediante bootstrap técnico auditado y establecimiento posterior de scope explícito.
2. Rechazo de creación ordinaria y consulta fuera del scope institucional.
3. Creación transaccional de cuenta, docente y vínculo institucional.
4. Desactivación docente con revocación de sesiones y reactivación sin restaurarlas.
5. Creación y consulta del año lectivo actual.
6. Rechazo de dos años actuales en una institución.
7. Creación de curso con contexto y valores normalizados.
8. Rechazo de curso duplicado por combinación normalizada.
9. Creación de materia genérica sin disciplina curricular obligatoria.
10. Creación de dos asignaciones docentes válidas.
11. Rechazo de terna duplicada.
12. Rechazo separado de docente, curso y materia pertenecientes a otra institución.
13. Rechazo de curso o materia inactivos al crear una asignación.
14. Consulta docente propia mediante servicio y `GET /api/v1/me/teaching-assignments`.
15. Rechazo de lectura por UUID de una asignación ajena.
16. Retiro lógico que conserva la fila y elimina el acceso docente operativo.
17. Auditoría de éxitos y rechazos sin contraseñas, hashes, cookies ni tokens.

Adicionalmente, una prueba HTTP verifica rechazo sin sesión, rechazo de mutación sin CSRF y creación autorizada atravesando router, controlador, servicio, repositorio y Prisma.

La ejecución paralela de integración expuso un conflicto serializable `P2034` en delegación. Se incorporó un reintento acotado de hasta tres intentos en las transacciones de autorización y académicas. La corrida final desde cero aprobó sin fallos.

## Ejecución del 25/09/2026 — frontend del Hito 1

| Verificación | Resultado |
|---|---|
| React Testing Library/Vitest | 1 archivo, 8/8 pruebas aprobadas |
| Build Vite de producción | Aprobado; 103 módulos transformados |
| Playwright sobre Chrome local | 1/1 recorrido aprobado |
| `npm run typecheck` | Shared, API y Web aprobados |
| `npm run build` | Shared, API y Web aprobados |
| `npm test` | Shared 1, API 11 y Web 8 aprobadas; 45 integraciones PostgreSQL omitidas por defecto |

La cobertura frontend verifica:

1. Redirección de una ruta privada cuando no existe sesión.
2. Login correcto, error uniforme y transporte con `credentials: "include"`.
3. Restauración de sesión al recargar.
4. Controles administrativos presentes o ausentes según la respuesta de autorización.
5. Formularios de año lectivo y curso.
6. Obtención de CSRF, encabezado `x-csrf-token` y ausencia de escritura en Web Storage.
7. Mensajes de interfaz específicos para `403`, `409` y `422`.
8. Estado vacío docente y ausencia de navegación/controles administrativos.

El E2E construye el frontend, lo sirve con un servidor estático efímero y simula únicamente las respuestas de la API con datos ficticios. Recorre login administrador → institución → docente → año/curso → materia → asignación → logout → login docente → Mis asignaciones → acceso ajeno `403`. Las credenciales de prueba no se persisten y no corresponden a usuarios reales.

La integración PostgreSQL de 56 casos no se repitió porque este checkpoint no altera backend, Prisma ni migraciones. Su resultado estable queda registrado en la sección anterior.

## Ejecución del 25/09/2026 — validación real completa del Hito 1

La corrida final de integración usó la base aislada y vacía `edugestor_hito1_final_20260925_0835` en PostgreSQL 17. La base de demostración `edugestor` se conservó para verificar reinicios y el recorrido real.

| Verificación | Resultado |
|---|---|
| `npm run prisma:validate` | Schema válido |
| `npm run prisma:generate` | Prisma Client 6.12.0 generado |
| Migración desde base vacía | 4/4 migraciones aplicadas |
| `prisma migrate status` sobre desarrollo | 4 migraciones; esquema al día |
| Integración con `RUN_DATABASE_TESTS=1` | 11 archivos, 60/60 pruebas aprobadas |
| `npm run typecheck` | Shared, API y Web aprobados |
| `npm run build` | Shared, API y Vite aprobados; 104 módulos transformados |
| `npm test` | Shared 1/1, API ordinaria 13/13, Web 8/8 |
| `npm run test:e2e` | E2E simulado existente 1/1 aprobado |
| `npm run test:e2e:real` | E2E real 1/1 aprobado |
| Reinicio `api`/`web` | Health disponible y E2E real nuevamente 1/1 |
| Consulta PostgreSQL tras reinicio | 2 asignaciones vigentes y 2 auditorías de bootstrap |

El nuevo E2E real no usa `page.route`, mocks ni respuestas sintéticas. Recorre el frontend contenedorizado, las rutas HTTP reales, cookies HttpOnly/CSRF, autorización y PostgreSQL. Comprueba:

1. login del administrador;
2. existencia de institución, dos docentes, año/curso, materia y dos asignaciones;
3. logout con sesión real;
4. login del primer docente;
5. proyección exclusiva de su propia asignación;
6. lectura propia por UUID con `200`;
7. lectura del UUID del segundo docente con `403`;
8. logout docente;
9. foco inicial, tabulación del formulario, foco del encabezado tras navegación y logout visible a 390 × 844.

El provisionador se ejecutó dos veces contra la misma base. Permanecieron 3 usuarios estándar, 2 docentes, 2 vínculos institucionales, 1 año, 1 curso, 1 materia, 2 asignaciones y 13 permisos concedidos; únicamente se añadió el evento de auditoría correspondiente a cada invocación.

La primera corrida de la nueva integración expuso un `P2034` al sincronizar el catálogo dentro de una transacción serializable concurrente. Se movió esa sincronización antes de la transacción del dataset y se mantuvieron reintentos acotados. Una repetición sobre la base ya alterada produjo colisiones de fixtures históricos; la evidencia final se obtuvo correctamente desde otra base vacía. También se corrigió una carrera de foco entre restauración de sesión y render de la ruta antes de la última corrida E2E.

Para repetir solo el E2E real, los servicios y el dataset deben existir y las cuatro variables de login/contraseña del administrador y primer docente deben estar en la sesión de shell:

```powershell
npm run test:e2e:real
```

## Ejecución del 25/09/2026 — refinamiento estructural curricular

La migración `20260925120000_curriculum_structure_refinement` se validó primero sobre la base persistente actual y después sobre el esquema temporal vacío `curriculum_empty_20260925_1500`.

| Verificación | Resultado |
|---|---|
| `npm run prisma:validate -w @edugestor/api` | Schema válido |
| `npm run prisma:generate -w @edugestor/api` | Prisma Client 6.12.0 generado |
| Migración sobre base actual | Aplicada; 2 materias, 2 cursos, 3 asignaciones y sus UUID conservados |
| Valores enum anteriores | 2 referencias preservadas en `AuditLog`; 0 correspondencias inventadas |
| Migración desde vacío | 5/5 migraciones aplicadas; 21 tablas; `migrate status` al día |
| Integración con `RUN_DATABASE_TESTS=1` | 12 archivos, 68/68 pruebas aprobadas |
| `npm run typecheck` | Shared, API y Web aprobados |
| `npm run build` | Shared, API y Vite aprobados; 104 módulos transformados |
| `npm test` | Shared 1/1, API ordinaria 13/13 y Web 8/8 |
| `npm run test:e2e` | E2E simulado del Hito 1, 1/1 aprobado |
| `npm run test:e2e:real` | React → Express → PostgreSQL, 1/1 aprobado |

La nueva integración PostgreSQL comprueba:

1. materia institucional sin correspondencia y `TeachingAssignment` independiente;
2. Algorítmica con correspondencias vigentes para 1.º, 2.º y 3.º BTI;
3. Matemática Aplicada vinculada al nombre oficial “Matemática Aplicada a la Informática”;
4. Diseño Gráfico de 3.º BTI en Plan Optativo con `academicAreaId = NULL`;
5. rechazo de un área perteneciente a otro `PlanType` mediante FK compuesta;
6. rechazo de dos correspondencias vigentes para la misma materia/año mediante índice único parcial;
7. retiro y reemplazo conservando ambas filas históricas;
8. rangos `1..3` de `Course.btiYear` y `SubjectCurriculumMapping.btiYear`;
9. regresión completa de autenticación, permisos/scopes, administración académica y asignaciones docentes.

Las suites de autenticación y persistencia usan ahora sufijos aleatorios en sus claves únicas, por lo que pueden repetirse contra una base persistente sin confundir residuos de fixtures con regresiones. El E2E real fue ejecutado después de reconstruir `api` y `web`; las credenciales se generaron en memoria y no se escribieron en el repositorio.


## Matriz ejecutada — API, autorización y UX curricular (25/09/2026)

**Estado: implementación completada.** La cobertura se distribuye entre la integración estructural previa, `curriculum-api.integration.test.ts`, las suites de autorización/académica, RTL y los E2E del Hito 1. Referencias: API.md sección curricular y DECISIONS.md CUR-API-01. No se implementaron mallas pedagógicas para satisfacer pruebas.

| ID local de prueba | Nivel | Caso y resultado verificable |
|---|---|---|
| CUR-01 | Unitario | Los cuatro códigos usan curriculum-catalog y subject-curriculum-mapping; no existe alias plural ni cambio a los 13 originales. |
| CUR-02 | Integración | Sincronizar el catálogo dos veces no duplica permisos ni concede automáticamente permisos nuevos a usuarios/demo. |
| CUR-03 | HTTP | Sin sesión/revocada: 401 AUTHENTICATION_REQUIRED; escritura sin CSRF: 403 CSRF_TOKEN_INVALID; conservar error.requestId. |
| CUR-04 | HTTP/DB | Permiso correcto con scope incorrecto, scope correcto sin permiso y combinación de concesiones diferentes: rechazados sin escritura. |
| CUR-05 | HTTP | subject.manage no autoriza gestionar correspondencias ni catálogo; manage no implica read. |
| CUR-06 | HTTP/DB | Catálogo compartido: lectura autorizada devuelve planes/áreas/disciplinas, sin datos institucionales inversos; filtros y paginación no filtran datos ajenos. |
| CUR-07 | HTTP/DB | Crear Diseño Gráfico con Plan Optativo/área NULL conserva clasificación INCOMPLETE; completar área válida conserva UUID y audita. |
| CUR-08 | HTTP/DB | Área de otro plan: 422 AREA_PLAN_MISMATCH y ninguna escritura; completar área no crea malla. |
| CUR-09 | HTTP | Duplicidad de code, UUID/referencias inválidos, claves prohibidas y filtros contradictorios producen los errores documentados. |
| CUR-10 | Seguridad | Administrador institucional con código curriculum-catalog.manage incluso provisionado indebidamente: escritura compartida denegada. Delegación ordinaria del código: DELEGATION_DENIED. |
| CUR-11 | Seguridad/DB | Operación técnica: exige autorización explícita de acción, TECHNICAL, technicalReason y CSRF; éxito auditado. Tipo TECHNICAL por sí solo o motivo ausente no habilitan operación. |
| CUR-12 | HTTP/DB | Crear correspondencia sin malla y sin área es válido; consultar materia sin correspondencia devuelve lista vacía. |
| CUR-13 | HTTP/DB | Solo una vigente por subjectId/btiYear; niveles distintos permitidos; 0/4 se rechazan; AcademicYear no sustituye btiYear. |
| CUR-14 | Concurrencia DB | Dos POST concurrentes para materia/nivel: exactamente uno crea y el otro devuelve 409; comprobar estado y auditoría. |
| CUR-15 | HTTP/DB | Retirar preserva UUID y fila; repetir con versión actual es idempotente; versión antigua: STALE_VERSION, sin segundo evento de cambio. |
| CUR-16 | HTTP/DB | Sustitución deja anterior retirada/nueva vigente; misma materia/nivel; nueva disciplina; ambas filas históricas. Misma disciplina: NO_CHANGE. |
| CUR-17 | Concurrencia DB | Sustitución vs retiro o dos sustituciones: sin doble vigente ni pérdida de referencia anterior; control de versión/reintentos acotados. |
| CUR-18 | Transacción DB | Fallo al insertar reemplazo o auditar revierte retiro y creación. Éxito y auditoría son atómicos; errores no exponen Prisma/SQL. |
| CUR-19 | Seguridad HTTP | Institución A no modifica/consulta correspondencias de B manipulando institutionId/subjectId/mappingId; 404 uniforme sin datos ajenos. |
| CUR-20 | Seguridad HTTP | Lectura limitada a curso exige courseId autorizado y restringe nivel; asignación docente ajena/finalizada no habilita lectura. Sin Course.btiYear no devuelve todos los niveles. |
| CUR-21 | Seguridad | COURSE_SET no escribe correspondencia compartida; RESOURCE_SET sigue rechazado y no se habilita incidentalmente. |
| CUR-22 | HTTP/DB | Subject/Institution inactivos impiden creación/sustitución, conservan lectura histórica autorizada y permiten retiro administrativo como cierre. |
| CUR-23 | HTTP/DB | Modificar clasificación utilizada de forma que reinterprete historia: HISTORICAL_REFERENCE_CONFLICT; completar área antes desconocida se distingue de reatribuir identidad. |
| CUR-24 | Contrato | Las respuestas actuales omiten curriculumAvailability. No consultan Curriculum ni generan datos de capacidades/contenidos/indicadores. |
| CUR-25 | RTL | Crear materia sin selector obligatorio; asociar/retiro/sustitución solo con permisos; confirmaciones, manejo 401/403/409/422 y campos conservados ante conflicto. |
| CUR-26 | RTL | Mostrar “Sin referencia curricular” o referencia con disponibilidad aún no consultable; área desconocida sin opción ficticia; etiqueta Conducta. |
| CUR-27 | E2E real | Administrador autorizado asocia/sustituye/retira; docente autorizado consulta; administrador ajeno rechazado. Fixtures solo en prueba, no catálogo ficticio productivo. |
| CUR-28 | Regresión Hito 1 | Crear materia/asignación sin correspondencia → login docente → consulta propia 200 y ajena 403; no cambiar UUID históricos ni omitir materias por joins. |
| CUR-29 | Auditoría | Éxitos/rechazos relevantes tienen actor/contexto/acción/resultado; technicalReason en excepción; sin hashes, cookies, credenciales ni datos ajenos. |

Los identificadores CUR-* organizan pruebas locales; no son RF/RNF nuevos. La protección futura de referencias AnnualPlan/Curriculum se conserva como contrato, pero no se crean esos modelos ni fixtures ficticios.

### Ejecución del checkpoint API/UX curricular

| Verificación ejecutada | Resultado |
|---|---|
| `npm run prisma:validate` | Schema válido |
| `npm run prisma:generate` | Prisma Client 6.12.0 generado |
| `npm run prisma:migrate:deploy -w @edugestor/api` | 5 migraciones; ninguna pendiente |
| `npm exec -w @edugestor/api prisma migrate status` | Esquema al día |
| `RUN_DATABASE_TESTS=1 npm run test -w @edugestor/api` | 13 archivos, 77/77 pruebas aprobadas |
| `npm test` | Shared 1/1, API ordinaria 13/13, Web RTL 10/10 |
| `npm run typecheck` | Shared, API y web aprobados |
| `npm run build` | Shared, API y web aprobados; 104 módulos Vite |
| `npm run test:e2e` | E2E simulado del Hito 1, 1/1 aprobado |
| `npm run test:e2e:real` | React → Express → PostgreSQL, 2/2 aprobados: curricular y Hito 1; propio 200/ajeno 403 |

La integración curricular nueva comprueba catálogo de 17 permisos sin concesiones demo, autenticación/CSRF, política técnica con concesión explícita, rechazo del administrador ordinario y de una cuenta técnica sin concesión, prohibición de delegación, lectura contextual, aislamiento institucional, rechazo de `COURSE_SET` para escritura, catálogo paginado, omisión de `curriculumAvailability`, unicidad/concurrencia, sustitución, retiro idempotente, historia y auditoría. La integración estructural conserva las pruebas de área nullable, área/plan incompatible, rangos BTI, materia sin correspondencia e independencia de `TeachingAssignment`.

RTL comprueba además materia sin referencia, ausencia de afirmaciones ficticias sobre malla, referencia vigente, área aún no validada y visibilidad de las acciones autorizadas. El E2E curricular real asocia, sustituye, retira, vuelve a asociar, comprueba `404` entre instituciones y valida la lectura docente por curso; el E2E de regresión conserva el recorrido Hito 1. Ambos se ejecutaron con imágenes reconstruidas y credenciales/fixtures efímeros, sin interceptar API ni persistencia.

### Pruebas futuras de disponibilidad — diferidas explícitamente

Al implementar el módulo real de mallas, comprobar NOT_AVAILABLE vs VALIDATED_AVAILABLE para disciplina/nivel exactos, malla confirmada, límites de V1.0 y presentación de los dos estados definitivos. Tener una malla de 2.º no habilita 3.º. Estos casos no son condición de salida del próximo checkpoint y no se registran como ejecutados.

### Ejecución y evidencia esperada para Codex

Usar Vitest, Supertest/PostgreSQL desechable, RTL y Playwright según la configuración existente. Ejecutar typecheck/build/suite ordinaria, integración con RUN_DATABASE_TESTS=1 en base de prueba y E2E real del Hito 1 más recorrido curricular. No declarar que la suite ordinaria cubre las pruebas DB omitidas por defecto. Registrar resultados reales por grupo; reutilizar pruebas estructurales existentes y ampliar solo para contratos/autorización/UX/concurrencia. No modificar bases productivas ni generar migraciones para pruebas de módulos futuros.
