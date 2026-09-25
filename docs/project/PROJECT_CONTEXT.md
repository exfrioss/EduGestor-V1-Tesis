# EduGestor V1.0 — Contexto de continuidad

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

### Siguiente checkpoint exacto

**Definir y aprobar el contrato del módulo Curriculum/mallas antes de implementar capacidades, contenidos, indicadores o disponibilidad validada.**

La siguiente tarea debe comenzar leyendo los documentos normativos y decidir la fuente/versionado de mallas, su relación exacta con `CurriculumDiscipline` + `btiYear`, permisos, auditoría y estados de disponibilidad. No inferir datos ni ampliar el dominio antes de esa aprobación.
