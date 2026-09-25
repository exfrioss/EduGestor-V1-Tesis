# EduGestor V1.0 — Contexto de continuidad

## CHECKPOINT COMPLETADO — Refinamiento estructural curricular

**Fecha:** 25/09/2026.

**Rama:** `feat/curriculum-structure`.

**Estado:** estable; sin commit Git.

### Implementado

- Prisma incorpora `PlanType`, `AcademicArea`, `CurriculumDiscipline` y `SubjectCurriculumMapping` conforme a `DATABASE.md`.
- `Course.btiYear` es `SmallInt` nullable y PostgreSQL limita sus valores a `1..3` cuando existe.
- `CurriculumDiscipline.planTypeId` es obligatorio; `academicAreaId` es nullable y una FK compuesta impide usar un área de otro plan.
- `SubjectCurriculumMapping.btiYear` se limita a `1..3`; un índice único parcial permite una sola correspondencia vigente por `(subjectId, btiYear)` y conserva filas retiradas mediante `retiredAt`.
- Todas las relaciones nuevas usan UUID, `ON DELETE RESTRICT`, timestamps, `rowVersion` e índices aprobados.
- `Subject` continúa siendo institucional y genérico. Se retiró el enum antiguo y ninguna materia recibió correspondencias automáticas.
- `TeachingAssignment` conserva sus relaciones y puede crearse/consultarse aunque la materia no tenga correspondencia curricular.
- La API de cursos acepta y devuelve `btiYear`; la API de materias ya no acepta ni devuelve el campo enum `curriculumDiscipline`.
- El frontend eliminó el selector curricular antiguo sin añadir navegación ni simular catálogos.

### Migración creada

`20260925120000_curriculum_structure_refinement`

La migración es aditiva para los cuatro catálogos/relaciones y `Course.btiYear`. Antes de retirar el enum anterior, conserva cada valor no nulo en un `AuditLog` de proceso; no lo convierte en correspondencia porque carece del año BTI requerido.

Validación de datos existentes:

- antes: 2 materias, 2 cursos, 3 asignaciones y 2 referencias enum;
- después: los mismos conteos y UUID de materias, cursos y asignaciones;
- las 2 referencias antiguas quedaron registradas como evidencia de migración;
- `prisma migrate status`: 5 migraciones, esquema al día.

Validación desde vacío:

- esquema PostgreSQL temporal limpio;
- 5/5 migraciones aplicadas;
- 21 tablas creadas;
- esquema temporal eliminado después de comprobarlo.

### Pruebas ejecutadas

- `prisma validate`: aprobado.
- `prisma generate`: aprobado.
- Integración PostgreSQL completa: 12 archivos, 68/68 pruebas aprobadas.
- Casos curriculares: materia sin correspondencia; Algorítmica en 1.º/2.º/3.º; Matemática Aplicada a la Informática; Diseño Gráfico de 3.º en Plan Optativo sin área; rechazo de área de otro plan; unicidad vigente; retiro/reemplazo histórico; rangos BTI; independencia de `TeachingAssignment`.
- `typecheck`: shared, API y web aprobados.
- `build`: shared, API y web aprobados; Vite transformó 104 módulos.
- Suite ordinaria: shared 1/1, API 13/13 y web 8/8; las pruebas PostgreSQL se omiten por diseño sin `RUN_DATABASE_TESTS=1`.
- E2E simulado del Hito 1: 1/1 aprobado.
- E2E real React → Express → PostgreSQL: 1/1 aprobado después de reconstruir/reiniciar los contenedores; acceso propio `200` y ajeno `403`.

### Incidencias corregidas

- El bootstrap demo no era idempotente si una base persistente ya tenía la concesión raíz creada por otra cuenta técnica. Ahora conserva `grantedById`/`delegatedById` históricos en vez de reatribuir procedencia.
- Dos suites PostgreSQL usaban logins fijos y colisionaban al repetirse sobre una base persistente. Los fixtures ahora generan sufijos únicos.
- El E2E simulado todavía buscaba el selector curricular retirado; se actualizó al contrato genérico de `Subject`.
- El E2E real asumía una única celda por docente/institución. Se hicieron deterministas sus selectores para convivir con historia persistida sin relajar la comprobación de aislamiento.

### Límites vigentes

- No existe API, pantalla ni bootstrap para administrar catálogos o correspondencias curriculares.
- No se crearon áreas ficticias ni datos curriculares de demostración.
- No se implementaron capacidades, contenidos, indicadores, plan anual, plan diario ni IA.
- Las correspondencias se validan por restricciones PostgreSQL y pruebas de integración; su caso de uso de administración queda pendiente de un checkpoint aprobado.
- No se modificaron `REQUIREMENTS.md`, `DATABASE.md`, `PROJECT_MASTER.md` ni `legacy/`.

### Siguiente checkpoint exacto

**Definir y aprobar los contratos API, permisos y casos de uso para administrar PlanType, AcademicArea, CurriculumDiscipline y SubjectCurriculumMapping; después implementar ese módulo sin acoplar TeachingAssignment ni ampliar todavía el currículo pedagógico.**
