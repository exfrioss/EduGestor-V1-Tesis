# Changelog

## 12/11/2026 — Hito 3A Asistencia implementado y verificado

- Se añadió la décima migración `20261112120000_hito3a_attendance` con enum de cuatro estados, sesión por asignación/fecha y registro único por sesión/matrícula. Incluye FK restrictivas, índice no único de sesiones por fecha, índice de historial, CHECK de justificación y triggers de contexto, inmutabilidad y no eliminación física. No duplica las FK compuestas previas de curso/año/institución y matrícula/curso/año.
- Se agregaron `attendance.read` y `attendance.manage` al catálogo (33 códigos), sin grants demo automáticos. La API implementa las siete rutas aprobadas con autorización por asignación y curso reales, sesión, CSRF, auditoría transaccional, versión optimista, lote atómico y reintentos serializables acotados. La UX Materia → Asistencia separa «sin marcar» de los cuatro estados, guarda lote explícito y muestra fecha, período e historial.
- Validación en PostgreSQL desechable: diez migraciones desde cero, `prisma validate/generate`, `migrate status` al día, API con DB real 132/132 en 18 archivos. `npm test` aprobó Shared 1/1, API 32/32 con 100 DB omitidas por configuración y Web 21/21. Typecheck, build y E2E simulado aprobaron; E2E real 6/6 con un worker confirmó Hito 1, currículo, 2A, 2B y 3A. Una primera corrida E2E paralela encontró un puerto temporal no disponible en la prueba de escala; la prueba aislada aprobó. La integración API eliminó luego la fixture sintética de Hito 1 de la misma base desechable y causó un fallo de login en la primera repetición secuencial; se repuso la fixture y la corrida completa aprobó.
- Se actualizaron los resultados A-01 a A-29 en TESTS.md. REQUIREMENTS.md, DATABASE.md y PROJECT_MASTER.md no se modificaron. No hubo commit, merge ni tag.

## 12/11/2026 — Hito 3A Asistencia aprobado como contrato documental

- Se formalizó [ATT-3A-01](../architecture/DECISIONS.md) y se añadieron a API.md siete contratos REST de sesión, registro individual/lote y consultas por fecha, período, curso, materia y matrícula. La matriz A-01 a A-29 de TESTS.md es **prevista y no ejecutada**. No se modificaron RF/RNF ni se generaron código o migraciones.
- Se aprobó `AttendanceStatus` de cuatro valores, `AttendanceSession` por asignación/fecha y `AttendanceRecord` único por sesión/matrícula; varias sesiones de una fecha son válidas. Fecha/asignación de sesión, vínculo sesión/matrícula del registro y `recordedById` creador son inmutables. Corrección conserva UUID, actualiza `rowVersion`/`updatedAt` y audita actor y before/after. No hay PATCH/DELETE físico ni marcas automáticas al crear sesión.
- `isJustified=false` implica `justificationObservation=null`; false con texto no nulo se rechaza y true → false limpia el texto anterior. La observación general permanece independiente y justificar no altera el estado. Nueva marca requiere `Enrollment` compatible existente al escribir; `createdAt` no sirve como vigencia académica. Solo registros existentes certifican sesiones históricas; nuevas matrículas no generan marcas retrospectivas. Student inactivo conserva lectura y corrección de marca existente autorizada, sin nueva marca.
- Se documentaron los permisos futuros `attendance.read` y `attendance.manage`, separados y sin concesión automática: catálogo 31 → 33 al implementarlos. La futura migración añadirá enum, dos modelos, FK restrictivas, único del registro, índices no únicos de sesión por asignación/fecha e historial, CHECK de justificación, integridad de curso/año y protección contra reasignación/borrado. Se reutilizarán las restricciones ya presentes en nueve migraciones.
- UX aprobada **Materia → Asistencia** con fecha, sesiones existentes, tabla de 20–40 alumnos, marcas explícitas, lote atómico, filtros e historial. Siguen abiertas la equivalencia de clases del mismo día y la vigencia temporal de matrícula; no se agregaron hora/bloque, retiro, unicidad diaria, reportes PDF ni módulos fuera de 3A.

## 02/11/2026 — Hito 2B-2 implementado

- La octava migración añade `GradingScale`, la referencia institucional nullable en `TeachingAssignment`, unicidad de versión y protección de versiones usadas. Ajusta los triggers de 2B-1 para permitir cambios de máximo solo dentro de la transacción confirmada.
- El catálogo suma `grading-scale.read/manage` (31 permisos en total), sin grants demo. La API valida JSON v1 y decimales canónicos, conserva versiones, convierte y redondea notas formales solo con base ordinaria y sin pendientes.
- Las rutas de escala y máximo presentan proyecciones antes/después y exigen token HMAC ligado a actor, sesión, recurso, versiones y digest del contexto. La confirmación reautoriza, verifica snapshot y audita sin cambiar puntajes históricos. La UI muestra nota formal, configuración de escala y confirmación/cancelación de cambios.
- Validación: ocho migraciones desde una base PostgreSQL temporal vacía, 103/103 pruebas API con DB real, 15/15 pruebas web, `prisma validate/generate`, typecheck y build. No se aplicó la migración a la base de desarrollo. No hubo commit, merge ni tag.

## 06/10/2026 — Hito 2B-1 implementado

- Se añadieron cuatro modelos y la migración `20261006120000_hito2b1_tasks_assessments` con CHECK, UNIQUE, FK restrictivas y triggers de contexto de tarea, evaluación, resultado y matrícula; las seis migraciones previas se conservaron.
- El catálogo suma 29 permisos: los 21 anteriores intactos y ocho de banco, tareas, evaluaciones y resultados. El bootstrap demo no recibe concesiones nuevas.
- Se implementaron las rutas 2B-1 con banco privado, tareas, evaluaciones independientes/vinculadas, copias independientes, resultados atómicos y Proceso D/O/X/T en Decimal. La nota formal permanece nula.
- El portal docente añadió Tareas y Evaluaciones y Proceso, con banco, reutilización entre asignaciones propias, captura/corrección individual, pendientes frente a cero, desglose y paginación.
- En PostgreSQL aislado aprobaron siete migraciones desde vacío y 97/97 pruebas de integración API; suite ordinaria shared 1/1, API 13/13 con 84 DB omitidas y web 14/14. Typecheck/build, E2E simulado 1/1 y E2E real 4/4 aprobaron; los tres recorridos reales anteriores regresaron sin fallas.
- Las primeras pruebas detectaron expectativas fijas de 21 permisos, un fixture de cálculo que compartía actividades y una consulta RTL ambigua/transitoria; se corrigieron antes de la validación final. Tras la integración se reprovisionaron las credenciales ficticias del demo aislado para repetir el E2E de Hito 1. `npm` no está instalado en el host, por lo que se invocaron los binarios locales equivalentes.
- 2B-2 sigue pendiente: escala, conversión/redondeo, cambios confirmados y nota formal. No hubo commit, tag ni merge; REQUIREMENTS.md, DATABASE.md y PROJECT_MASTER.md permanecen intactos.

## 06/10/2026 — Hito 2B aprobado como contrato documental

- Se fijó el alcance de ActivityBankItem, Task, Assessment, AssessmentResult, GradingScale, TeachingAssignment.gradingScaleId y Proceso, dividido técnicamente en 2B-1 (cuatro modelos, ocho permisos, resultados, Proceso sin nota) y 2B-2 (escala, dos permisos, nota formal y cambios de máximo/escala con preview y confirmación). No se generaron código, migraciones ni pruebas ejecutadas de 2B.
- API.md incorpora rutas, permisos, scope, aislamiento del banco privado, reutilización, resultados únicos, concurrencia, errores, UX y cálculo de puntos ordinarios/adicionales sobre matrículas reales. Pendientes producen porcentaje parcial y `formalGrade = null`; D=0 no genera porcentaje ni nota.
- Se aprobó JSON discriminado versión 1 `PERCENTAGE_BANDS` para conversión y `NONE`/`DECIMAL_PLACES` para redondeo, sin umbrales ni valores institucionales predefinidos. La versión de escala utilizada permanece inmutable; la nota formal requiere escala completa, D>0 y cero pendientes.
- Preview/confirmación de máximo y cambio de escala usa `confirmationToken` HMAC-SHA-256 de cinco minutos unido a actor, sesión, recurso, versiones, cambio y `contextDigest`, revalidado transaccionalmente con auditoría. La matriz B-01 a B-27 incluye los subcasos de JSON, parcialidad, token y concurrencia, todos pendientes.
- Se registró ACAD-2B-01 y el próximo checkpoint Codex 2B-1. Los 34 RF, 15 RNF y D-01 a D-07 permanecen intactos; no se modificaron REQUIREMENTS.md, DATABASE.md ni PROJECT_MASTER.md.

## 05/10/2026 — Hito 2A Student + Enrollment implementado

- Se añadió `Student` global y `Enrollment` histórico contextual con migración restrictiva, índices, CHECK de cédula/activación, FK compuesta y bloqueo de cambios destructivos de matrícula. Se verificó que `Course_academic_year_institution_fkey` ya existía.
- El catálogo pasó de 17 a 21 permisos sin ampliar las concesiones demo. Se implementaron las nueve rutas de API.md con autorización contextual, bloqueo de Student para cambios globales y nuevas matrículas, control de versión, CSRF y auditoría transaccional.
- La UI añadió Curso → Estudiantes y Materia → Perfiles de Alumnos con identidad y matrícula autorizadas, búsqueda, cédula opcional, reutilización visible e indicador de inactividad.
- En base PostgreSQL aislada pasaron 89/89 pruebas de API, las suites ordinarias shared 1/1, API 13/13 y web 12/12, E2E simulado 1/1 y real 3/3. Typecheck, build, Prisma validate/generate/deploy/status aprobaron. Hito 1 y currículo pasaron regresión real.
- Se corrigieron una colisión entre ejecuciones en el dato de prueba de cédula y un selector ambiguo del E2E. Tras la suite de bootstrap se reprovisionaron credenciales ficticias del demo antes de repetir E2E real. No se modificaron REQUIREMENTS.md, DATABASE.md ni PROJECT_MASTER.md; no hubo commit.

## 04/10/2026 — Diseño aprobado del Hito 2A (documentación)

- Se documentó el checkpoint cerrado Student + Enrollment en API.md y la decisión STU-ENR-01 en DECISIONS.md, sin nuevos RF/RNF, código ni migraciones.
- Se definieron para implementación futura `student.read`, `student.manage`, `enrollment.read` y `enrollment.manage` sin concesión automática; la lectura requiere matrícula visible y, para docentes, TeachingAssignment propia vigente.
- Se aprobaron rutas privadas de alta conjunta, búsqueda contextual, nómina, detalle Student/Enrollment, historial autorizado, corrección identificativa y activación, además de alta de otra matrícula con identidad visible. No hay rutas para eliminación, finalización o traslado de Enrollment.
- Se fijó denegación genérica cuando falte permiso para un cambio global de Student, sin enumerar otras instituciones/matrículas; cédula ya registrada fuera del ámbito produce `409 CONFLICT` genérico, sin exponer UUID/contexto ni crear duplicado o fusión automática.
- Se especificaron cédula nullable normalizada única, matrícula triple única, contexto de año compatible, `rowVersion`, transacciones, auditoría, desactivación sin pérdida histórica y pruebas de concurrencia e aislamiento.
- UX aprobada: Institución → Curso → Estudiantes y Materia → Perfiles de Alumnos sobre las mismas entidades; solo identidad/matrícula hasta contar con fuentes de RF-034. Importación CSV/XLSX y demás módulos académicos/pedagógicos quedan fuera de 2A.
- La comparación con `schema.prisma` adjunto confirma que Student/Enrollment requieren migración posterior; debe revisarse primero la integridad Course–AcademicYear–Institution en las migraciones SQL ya aplicadas. TESTS.md registra pruebas **pendientes**, no resultados ejecutados.
- Se actualizó el contexto de continuidad usando como base los documentos más recientes del paquete adjunto, que ya registran implementación y 77/77 pruebas de la API curricular. REQUIREMENTS.md, DATABASE.md y PROJECT_MASTER.md no fueron modificados.

## 25/09/2026 — API, autorización y UX curricular

- Se incorporaron los cuatro permisos curriculares aprobados; el catálogo idempotente contiene 17 códigos y el bootstrap demo conserva exactamente los 13 del Hito 1.
- Se implementaron las 13 rutas REST documentadas para lectura del catálogo, administración técnica excepcional y consulta/creación/retiro/sustitución de correspondencias.
- La administración compartida exige cuenta técnica, concesión raíz explícita, motivo, sesión, CSRF y auditoría; el permiso no puede delegarse mediante el flujo ordinario.
- La autorización de correspondencias resuelve la institución real de `Subject`; `COURSE_SET` puede leer solo con contexto válido y no puede escribir.
- Retiro y sustitución preservan historia/UUID, usan `rowVersion`, transacción serializable y la unicidad parcial PostgreSQL existente.
- Materias muestra la nueva sección opcional “Referencia curricular”; no se simula `curriculumAvailability` y un área nula se identifica como aún no validada.
- Cursos permite capturar y editar el `btiYear` nullable ya incorporado al modelo.
- No fue necesaria una migración nueva. Prisma, migraciones, typecheck, build, 77/77 pruebas API con PostgreSQL, 10/10 RTL, E2E simulado y 2/2 E2E reales (curricular + Hito 1) aprobaron.
- No se modificaron requisitos, modelo normativo ni funcionalidades pedagógicas futuras.

## 25/09/2026 — Contratos curriculares, permisos y UX aprobados (documentación)

- Se verificaron los dos archivos reales del catálogo: convención recurso.acción y sincronización idempotente por código.
- Se documentaron curriculum-catalog.read/manage y subject-curriculum-mapping.read/manage, en singular, sin modificar los 13 permisos implementados.
- API.md define 13 rutas futuras de lectura/escritura del catálogo y creación/consulta/retiro/sustitución de correspondencias, solicitudes, respuestas, errores y autorización.
- Se conservaron error.requestId y los códigos existentes de autenticación, autorización y CSRF; no se cambiaron contratos del Hito 1.
- DECISIONS.md, recibido vacío, registra CUR-API-01: administración técnica excepcional sin scope global ni delegación institucional, historia/concurrencia, UX y límites del checkpoint.
- curriculumAvailability queda reservado al contrato futuro y omitido en el checkpoint; no se simula disponibilidad ni ausencia de mallas y no se exige implementar Curriculum, capacidades, contenidos o indicadores.
- PROJECT_CONTEXT.md registra la aprobación y el siguiente checkpoint de implementación; TESTS.md añade casos previstos, no ejecutados.
- Solo se actualizaron API.md, DECISIONS.md, PROJECT_CONTEXT.md, CHANGELOG.md y TESTS.md. No se modificaron documentos normativos, TypeScript, Prisma ni migraciones. No se ejecutaron suites de aplicación en esta tarea documental.


## 25/09/2026 — Refinamiento estructural curricular

- Se añadieron `PlanType`, `AcademicArea`, `CurriculumDiscipline` y `SubjectCurriculumMapping` al esquema Prisma aprobado.
- Se incorporó `Course.btiYear` nullable con rango PostgreSQL `1..3`.
- Una FK compuesta garantiza que el área opcional de una disciplina pertenezca a su mismo tipo de plan.
- Un índice único parcial garantiza una sola correspondencia vigente por materia/año BTI, conservando reemplazos históricos mediante `retiredAt`.
- Se retiró el enum curricular de `Subject` sin reasignar materias; sus valores previos no nulos quedan conservados en auditoría de migración.
- Se creó y validó la migración `20260925120000_curriculum_structure_refinement` tanto sobre la base existente como desde un esquema vacío.
- Se actualizó la API de cursos con `btiYear` y se retiró el campo obsoleto de la API/UI de materias, sin añadir navegación curricular.
- Se añadieron pruebas PostgreSQL para los ejemplos y restricciones normativas; la integración completa aprobó 68/68 y los E2E simulado/real del Hito 1 aprobaron 1/1.
- Se corrigió la procedencia idempotente del bootstrap demo y se hicieron repetibles los fixtures de integración sobre bases persistentes.
- No se implementaron APIs/pantallas curriculares, capacidades, contenidos, indicadores, planificación ni IA.

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
