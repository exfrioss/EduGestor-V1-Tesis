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

**Etapa de definición y aprobación completada en la actualización documental siguiente. El próximo checkpoint pasa a implementación API/UX, con el alcance exacto indicado al final de este documento.**


## CHECKPOINT DOCUMENTAL APROBADO — API, autorización y UX curricular

**Fecha:** 25/09/2026. **Estado:** especificación aprobada y documentada; implementación pendiente. La evidencia de implementación/pruebas del refinamiento estructural anterior se conserva y no representa ejecución de las nuevas APIs.

- Convención verificada en permission-catalog.ts y bootstrap-authorization-catalog.ts: recurso.acción, singular, minúsculas/kebab-case.
- Códigos aprobados: `curriculum-catalog.read`, `curriculum-catalog.manage`, `subject-curriculum-mapping.read`, `subject-curriculum-mapping.manage`. Hoy el código adjunto conserva 13 permisos; incorporar los cuatro será trabajo de implementación.
- Catálogo compartido: lectura contextual y escritura técnica excepcional explícita/auditada. No conceder administración compartida a administradores institucionales ni crear scope global. Revisar bootstrap/provisionadores para evitar otorgar automáticamente los nuevos permisos.
- Correspondencias: lectura por ámbito; creación/retiro/sustitución institucional con unicidad vigente, rowVersion, transacción y auditoría. RESOURCE_SET permanece no soportado.
- API.md define solicitudes/respuestas/errores y mantiene error.requestId y los errores existentes de sesión/CSRF/permisos. DECISIONS.md registra CUR-API-01; TESTS.md separa casos pendientes de evidencia previa.
- curriculumAvailability permanece futuro y se omite ahora. La UI no afirma disponibilidad ni ausencia de malla sin poder consultarla. No se requiere implementar Curriculum, capacidades, contenidos, indicadores, planificación o IA.
- UX: Inicio → Institución → Curso → Materia → espacio de trabajo; referencia opcional en Materias, área desconocida permitida y etiqueta Conducta para comportamiento.
- Hito 1 conserva 16 entidades, materias/asignaciones sin correspondencia y aislamiento docente/institucional.

### Siguiente checkpoint exacto para Codex — Implementar API y UX de referencias curriculares

1. Leer REQUIREMENTS.md revisión 4, DATABASE.md aprobado, API.md sección curricular, CUR-API-01 de DECISIONS.md y la matriz pendiente en TESTS.md. Respetar las instrucciones del repositorio.
2. Revisar el código actual de autorización técnica, bootstrap de catálogo y provisionadores demo; reutilizar las cuatro entidades ya implementadas. No rehacer su migración ni añadir un scope nuevo. Mantener los archivos normativos intactos.
3. Añadir exactamente los cuatro permisos a la convención existente y su sincronización idempotente, sin concesión automática ni vía de delegación institucional del permiso compartido.
4. Implementar lecturas del catálogo y correspondencias, después creación/retiro/sustitución y escrituras técnicas excepcionales. Reutilizar sesión/CSRF/errores/auditoría; resolver ámbito en servidor y proteger concurrencia.
5. Adaptar Materias para referencia opcional y acciones según permiso. No generar catálogos ficticios productivos. Omitir curriculumAvailability; mostrar su limitación sin consultar modelos futuros ni bloquear Hito 1.
6. Ejecutar los casos de TESTS.md para este checkpoint y la regresión del Hito 1. Registrar comandos, resultados reales y limitaciones; no reemplazar evidencia histórica ni declarar casos futuros como aprobados.

**Criterio de salida:** rutas y UX contractuales implementadas; pruebas HTTP/PostgreSQL, permisos/concurrencia y recorrido real aprobadas; materia sin correspondencia sigue operativa; ningún dato curricular inventado; sin ampliación hacia mallas, planificación o IA. Si el mecanismo de autorización técnica necesita una decisión no cubierta, documentar el punto y mantener esas escrituras denegadas, sin introducir privilegios globales por defecto.
