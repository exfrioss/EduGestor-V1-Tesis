# EduGestor V1.0 — Contexto de continuidad

## CHECKPOINT DOCUMENTAL APROBADO — Hito 2A: Student + Enrollment

**Fecha:** 04/10/2026. **Estado:** diseño aprobado y documentado; sin implementación de Student/Enrollment, sin migración ni pruebas ejecutadas de Hito 2A. **Base:** REQUIREMENTS.md revisión 4, DATABASE.md aprobado y paquete técnico más reciente que contiene `permission-catalog.ts` y `schema.prisma`. Los 34 RF y 15 RNF no cambian.

- Alcance: identidad Student independiente y matrícula Enrollment en Course + AcademicYear; alta conjunta atómica, búsqueda contextual, nómina, detalle, historial autorizado, corrección de identidad con UUID estable y activación/desactivación/reactivación sin pérdida histórica. RF-034 obtiene solo su base Student + Enrollment.
- Cuatro permisos **propuestos, no implementados**: `student.read`, `student.manage`, `enrollment.read`, `enrollment.manage`, según recurso singular. Los 17 existentes siguen vigentes; el demo no recibe los cuatro nuevos automáticamente. Solo ámbitos INSTITUTION/COURSE_SET implementados; `RESOURCE_SET` permanece rechazado.
- Docente: permisos efectivos y TeachingAssignment propia vigente para cada curso consultado. Institución: únicamente matrículas de su ámbito. Una modificación de Student global exige gestión sobre todos los contextos actuales; denegación genérica sin enumerar contextos no autorizados.
- Cédula externa ya existente: conflicto genérico, sin UUID o datos de institución/matrícula; no crear identidad duplicada ni fusión/reclamación automática. Sin cédula se admiten varios NULL y no se puede asegurar deduplicación global por nombre.
- Integridad: cédula original y normalizada ambas nulas o ambas informadas, índice único cuando existe, matrícula triple única, año compatible mediante FK compuesta, entidades activas para nuevos vínculos, historia sin borrado ni reasignación, `rowVersion`, transacciones y auditoría. Comprobar migraciones SQL existentes para la restricción Course–AcademicYear–Institution antes de agregarla.
- Estado técnico comprobable en el esquema adjunto: Course y sus claves candidatas existen; **Student y Enrollment no existen**. Se necesitará una migración posterior. El módulo curricular implementado permanece independiente.
- UX: Institución → Curso → Estudiantes y Materia → Perfiles de Alumnos utilizan las mismas entidades, preservando Inicio → Institución → Curso → Materia → espacio de trabajo. Buscar estudiante visible antes del alta, permitir cédula ausente, mostrar inactividad y abrir solamente identidad/matrícula hasta implementar los otros módulos.
- Fuera de 2A: tareas, banco, evaluaciones, calificaciones, puntos extra, asistencia, anecdótico, conducta, informes grupales, consulta pública, importación CSV/XLSX, planificación, mallas, IA y perfil integral completo. RF-022 puede abordarse en checkpoint posterior.
- Contratos completos: [API.md](../architecture/API.md), sección Hito 2A. Decisión [STU-ENR-01](../architecture/DECISIONS.md). Matriz pendiente en [TESTS.md](../tests/TESTS.md). Ningún resultado de pruebas de 2A se declara ejecutado.

### Siguiente checkpoint exacto para Codex — implementar Hito 2A

1. Leer estos contratos y el esquema real; comprobar las migraciones SQL para Course–AcademicYear–Institution y el tratamiento operativo de identidad ya registrada fuera del ámbito, sin conceder acceso global.
2. Incorporar los cuatro permisos al catálogo/sincronización sin alterar concesiones demo; añadir Student y Enrollment a Prisma y preparar una migración restrictiva con sus índices, `CHECK` y FK compuesta.
3. Implementar normalización, transacciones, bloqueo/versión, auditoría, autorización contextual y las rutas exactas de API.md. Para cambio global, denegar sin enumerar ámbitos; para cédula externa, `409` genérico sin datos ajenos.
4. Implementar nómina, búsqueda previa, alta/matrícula, detalle básico y acceso contextual desde Materia, sin datos de otros módulos.
5. Ejecutar y registrar pruebas PostgreSQL concurrentes, Supertest, RTL y E2E reales; repetir regresión Hito 1 y currículo. No declarar pruebas DB omitidas por la suite ordinaria como aprobadas.

## CHECKPOINT COMPLETADO — API, autorización y UX curricular

**Fecha:** 25/09/2026.

**Rama:** `feat/curriculum-api-ux`.

**Estado:** estable, validado y sin commit Git.

### Alcance implementado

- El catálogo técnico pasó de 13 a 17 permisos con `curriculum-catalog.read/manage` y `subject-curriculum-mapping.read/manage`.
- La sincronización continúa siendo idempotente. El bootstrap demo conserva una lista explícita de los 13 permisos del Hito 1 y no concede los cuatro nuevos.
- Se añadieron las 13 rutas aprobadas en `API.md`: tres lecturas del catálogo compartido, seis escrituras técnicas excepcionales y cuatro operaciones de correspondencias.
- El catálogo se pagina mediante cursor opaco ligado a filtros/contexto. Las respuestas no incluyen relaciones inversas institucionales ni `curriculumAvailability`.
- `curriculum-catalog.manage` exige simultáneamente cuenta `TECHNICAL`, concesión raíz explícita vigente, `technicalReason`, sesión, CSRF y auditoría. `accountKind` por sí solo no autoriza. La concesión no puede delegarse por `/authorization/grants`.
- La lectura del catálogo se reautoriza por institución; para docentes exige además vínculo y asignación operativa vigentes.
- Las correspondencias resuelven `Subject` y su institución en servidor. La escritura exige scope institucional completo; `COURSE_SET` solo puede leer en el curso/nivel autorizado y nunca modificar la referencia compartida.
- Crear, retirar y sustituir usa transacciones serializables, `rowVersion`, auditoría y el índice parcial existente. Sustituir retira y crea atómicamente; nunca modifica ni elimina el UUID histórico.
- La UI de Materias incorpora “Referencia curricular” opcional, estados vacío/carga/error, alta, retiro confirmado y sustitución. Un área nula se presenta como “Área académica aún no validada” y una referencia vigente como “Disponibilidad de malla aún no consultable”.
- Cursos permite capturar/editar `btiYear` nullable. `Subject` continúa genérico y `TeachingAssignment` no depende de una correspondencia.

### Persistencia y migraciones

No se creó una migración nueva en este checkpoint. Se reutiliza la migración versionada ya aprobada:

`20260925120000_curriculum_structure_refinement`

`prisma migrate deploy` informó que no había migraciones pendientes y `prisma migrate status` confirmó las 5 migraciones aplicadas. La restricción final sigue siendo el índice único parcial PostgreSQL sobre `(subjectId, btiYear) WHERE retiredAt IS NULL`.

### Validación ejecutada

- `prisma validate`: aprobado.
- `prisma generate`: Prisma Client 6.12.0 generado.
- `prisma migrate deploy`: 5 migraciones, ninguna pendiente.
- `prisma migrate status`: esquema al día.
- `RUN_DATABASE_TESTS=1 npm run test -w @edugestor/api`: 13 archivos, 77/77 pruebas aprobadas.
- Suite ordinaria `npm test`: shared 1/1, API 13/13 con 64 pruebas DB omitidas por diseño, web 10/10.
- `npm run typecheck`: shared, API y web aprobados.
- `npm run build`: shared, API y web aprobados; Vite transformó 104 módulos.
- `npm run test:e2e`: recorrido simulado del Hito 1 1/1 aprobado.
- `npm run test:e2e:real`: 2/2 aprobados contra React → Express → PostgreSQL: regresión Hito 1 (lectura propia `200`, ajena `403`) y recorrido curricular de asociación/sustitución/retiro, aislamiento `404` y lectura docente contextual.

### Incidencias encontradas y corregidas

- Expandir directamente `PERMISSION_CATALOG` habría otorgado los cuatro permisos nuevos al dataset demo. Se separó `HITO1_PERMISSION_CODES` y el demo conserva exactamente sus 13 concesiones previas.
- El comprobador genérico habría mostrado `curriculum-catalog.manage` como válido para una cuenta ordinaria con ese código. Ahora aplica la política técnica excepcional también al endpoint de comprobación.
- El primer E2E real no arrancó porque `.env` mantiene correctamente vacías las credenciales demo. Se provisionaron credenciales ficticias solo en memoria mediante el CLI y la repetición aprobó.
- Los curso existentes sin nivel BTI continúan válidos; la UI permite dejar `btiYear` vacío y la API de lectura contextual rechaza expresamente usar ese curso para inferir todos los niveles.

### Límites vigentes

- No existe pantalla cotidiana para administrar el catálogo compartido; sus seis escrituras son API técnica excepcional.
- No se crean datos curriculares ficticios ni se conceden permisos curriculares al dataset demo.
- `curriculumAvailability` permanece omitido hasta que exista una fuente real de mallas validadas.
- No se implementaron `Curriculum`, competencias/capacidades, contenidos, indicadores, carga de mallas, planificación, avance curricular ni IA.
- `RESOURCE_SET` continúa fuera de alcance.
- No se modificaron `REQUIREMENTS.md`, `DATABASE.md`, `PROJECT_MASTER.md` ni `legacy/`.

### Siguiente checkpoint previsto al cierre curricular del 25/09 (histórico)

**Definir y aprobar el contrato del módulo Curriculum/mallas antes de implementar capacidades, contenidos, indicadores o disponibilidad validada.** Esta era la siguiente tarea prevista el 25/09; el checkpoint activo de implementación es Hito 2A, descrito al comienzo de este documento.

La siguiente tarea debe comenzar leyendo los documentos normativos y decidir la fuente/versionado de mallas, su relación exacta con `CurriculumDiscipline` + `btiYear`, permisos, auditoría y estados de disponibilidad. No inferir datos ni ampliar el dominio antes de esa aprobación.
