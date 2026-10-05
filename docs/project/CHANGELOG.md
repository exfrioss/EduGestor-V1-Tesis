# Changelog

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
