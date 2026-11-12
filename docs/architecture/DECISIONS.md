# Decisiones de arquitectura

## ATT-3A-01 — Hito 3A: asistencia por sesión y matrícula

**Estado:** diseño aprobado el 12/11/2026; implementación y pruebas pendientes. **Tipo:** precisión técnica de RF-015, D-02/D-04 y RF-025, sin agregar RF/RNF ni reabrir decisiones resueltas. Contratos en [API.md](API.md), sección «Hito 3A»; pruebas previstas A-01 a A-29 en [TESTS.md](../tests/TESTS.md).

- La unidad de asistencia es `AttendanceSession`, no el día. Una `TeachingAssignment` puede tener varias sesiones con igual `classDate`, cada una con UUID propio; no existe `UNIQUE(teachingAssignmentId, classDate)`. `teachingAssignmentId` y `classDate` son inmutables desde el alta. No hay PATCH ni DELETE físico de sesión, y su creación no genera registros individuales.
- `AttendanceRecord` representa una marca explícita sobre un `Enrollment` compatible con el curso y año lectivo de la asignación. `UNIQUE(attendanceSessionId, enrollmentId)`; ambos identificadores son inmutables. Las correcciones conservan UUID y `recordedById`, que identifica exclusivamente al creador original; `updatedAt` y `rowVersion` reflejan modificación y concurrencia. `AuditLog` registra actor y before/after de cada corrección en la misma transacción.
- `AttendanceStatus` contiene solo `PRESENTE`, `AUSENTE`, `LLEGADA_TARDIA` y `SALIDA_ANTICIPADA`. `isJustified=false` exige `justificationObservation=null`; `isJustified=true` permite observación justificativa opcional. Cambiar de true a false limpia esa observación en la misma escritura. La observación general es independiente y justificar no cambia el estado.
- Para crear una marca debe existir al escribir una matrícula compatible. `Enrollment.createdAt` no es fecha efectiva de pertenencia ni autoriza o prohíbe por sí mismo una captura retrospectiva. Una matrícula posterior no crea marcas retroactivas. Solo los `AttendanceRecord` existentes certifican hechos de la sesión histórica; la nómina actual es ayuda operativa, no reconstrucción histórica certificada.
- Se aprueban `attendance.read` y `attendance.manage` como permisos independientes, sin concesiones automáticas; el catálogo real pasa de 31 a 33 únicamente cuando se implementen y sin implicación manage → read. El docente necesita cuenta, docente, vínculo institucional y asignación propia vigentes, además de permiso y ámbito efectivos. Sesión/CSRF, resolución del contexto desde PostgreSQL, integridad persistente y auditoría protegen las escrituras.
- La captura individual y por lote, las consultas por sesión, fecha, período, curso, materia y matrícula, y la UX **Materia → Asistencia** quedan especificadas en API.md. El lote es atómico y cada marca usa control de versión. No se presume una sola clase diaria ni una vigencia temporal o estado de retiro de Enrollment. Impresión/PDF y los demás módulos excluidos se mantienen fuera de 3A.

## ACAD-2B-01 — Hito 2B: resultado único, escala versionada y confirmación reproducible

**Estado:** diseño aprobado el 06/10/2026; 2B-1 y 2B-2 implementados y probados, este último el 02/11/2026. **Tipo:** precisión de RF-009–RF-014 y D-01/D-03, sin nuevos RF/RNF ni reapertura de D-01 a D-07. Contratos completos en [API.md](API.md), sección «Hito 2B»; evidencia en [TESTS.md](../tests/TESTS.md), matriz B-01 a B-27.

- **Dos checkpoints técnicos:** 2B-1 incorpora `ActivityBankItem`, `Task`, `Assessment`, `AssessmentResult`, ocho permisos, resultados y Proceso **sin nota formal**; quedó implementado y probado el 06/10/2026. 2B-2 incorpora `GradingScale`, `TeachingAssignment.gradingScaleId`, dos permisos, conversión/redondeo, nota formal y cambios de máximo/escala con preview/confirmación; quedó implementado y probado el 02/11/2026.
- `AssessmentResult` es la única fuente persistida de puntos individuales. Task puede existir sin Assessment; el primer resultado crea la única Assessment vinculada si no existe, de forma atómica. Assessment puede ser independiente. Se suman cada Task y cada Assessment independiente una sola vez; vincular nunca duplica el cómputo. El banco es privado por `ownerTeacherId` incluso frente a administración institucional, y la reutilización copia contenido con procedencia opcional, nunca permisos, matrículas o resultados.
- Permisos explícitos y separados `activity-bank.read/manage`, `task.read/manage`, `assessment.read/manage`, `assessment-result.read/manage` en 2B-1 y `grading-scale.read/manage` en 2B-2, siguiendo `recurso.acción`. Docente requiere usuario/vínculo activos, scope efectivo y TeachingAssignment **propia vigente**. Gestión de una escala aplicada exige además `teaching-assignment.manage` en la asignación. Rol por sí solo no concede permisos; no ampliar demo ni implementar `RESOURCE_SET`.
- Denominador `D` suma máximos ORDINARIA; numerador `T` suma obtenidos evaluados ordinarios y FUERA_DE_ESCALA. Si `D > 0`, porcentaje = `T/D × 100` sin tope interno, incluso parcial; si D=0 porcentaje nulo. Ausencia de fila o PENDIENTE nunca es cero; EVALUADO con cero sí. **Mientras cualquier actividad elegible esté pendiente, porcentaje se indica como parcial y `formalGrade = null`.** La nota solo se emite si `D > 0`, no hay pendientes y hay una escala válida, completa, versionada y aplicada; se limita al máximo formal. En 2B-1 siempre queda nula.
- En 2B-2 `conversionDefinition` JSON v1 discriminada `PERCENTAGE_BANDS` y `roundingDefinition` JSON v1 `NONE` o `DECIMAL_PLACES`. Umbrales/valores son configuración institucional, no constantes del producto. Versiones usadas de escala son inmutables; edición produce nueva versión, y el cambio aplicado a TeachingAssignment es explícito, auditado y confirmado.
- Si hay resultados, cambiar el máximo efectivo exige preview, advertencia, confirmación, versión/digest vigentes y auditoría transaccional. Una reducción conserva puntajes históricos superiores al máximo nuevo; los nuevos se validan contra el máximo actual. 2B-1 bloquea cambios de máximo con resultados hasta el flujo de 2B-2. Cambios concurrentes no pueden reinterpretar resultados silenciosamente.
- `confirmationToken` v1 es HMAC-SHA-256 sobre payload canónico, válido cinco minutos y ligado a actor, sesión, propósito, institución, asignación/recurso, versiones, valor anterior/nuevo y `contextDigest` del conjunto relevante de actividades, matrículas, resultados y escalas. Firma y snapshot se revalidan con permiso actual en la transacción; tras éxito el incremento de versión impide reutilización. Clave compartida entre instancias y rotación por `kid`, sin memoria local ni tabla de tokens. Errores/semántica exacta en API.md.
- UX: Inicio → Institución → Curso → Materia → Tareas y Evaluaciones / Proceso; nómina real de Hito 2A, pendientes claramente visibles. Asistencia, anecdótico, Conducta, informe grupal, consulta pública, importación, planificación, mallas, IA y RF-034 integral permanecen fuera de 2B.

## STU-ENR-01 — Hito 2A: identidad global y matrícula contextual

**Estado:** implementado y validado el 05/10/2026. **Fecha de decisión:** 04/10/2026. **Tipo:** concreción de RF-008 y D-01/D-02, sin nuevos RF/RNF ni modificación de D-01 a D-07. Contratos: [API.md](API.md), sección «Hito 2A: Student + Enrollment».

`Student` es una identidad global con UUID interno y cédula opcional normalizada, única si existe; `Enrollment` conserva la vinculación Student + Course + AcademicYear. El año de la matrícula debe ser el del curso; `AcademicYear` no equivale a `btiYear`. Una institución accede a Student **a través de matrículas autorizadas**, sin descubrir las demás. No hay cédulas ficticias, cuentas de estudiante, traslado silencioso ni eliminación física de historia. `Enrollment` no tiene en el modelo aprobado un estado, `endedAt` ni flujo de finalización ordinario.

Se aprueban para implementación, según la convención singular `recurso.acción`, `student.read`, `student.manage`, `enrollment.read` y `enrollment.manage`. Son permisos distintos y explícitos: `manage` no implica `read`; los roles no los conceden automáticamente. Las concesiones demo del Hito 1 permanecen iguales. `RESOURCE_SET` sigue sin soporte; institución y conjunto de cursos son los ámbitos efectivos del checkpoint. El docente requiere además `TeachingAssignment` propia vigente en cada curso leído.

**Precisión contractual de alcance global:** corregir datos identificativos o cambiar activación de un Student con matrículas en varios contextos exige `student.manage` efectivo sobre **todos** sus contextos institucionales existentes. Una denegación no identifica cuáles son los otros contextos, instituciones o matrículas. La comprobación se serializa con el alta concurrente de matrículas. Un administrador limitado a A puede consultar solo las matrículas autorizadas de A, aun cuando el mismo Student también esté matriculado en B.

**Precisión contractual de cédula externa:** búsqueda solo entre identidades visibles. Si `nationalIdNormalized` ya pertenece a una identidad fuera de ese ámbito, la restricción única produce un `409 CONFLICT` genérico sin `studentId`, institución o matrícula. No crear duplicado, fusionar ni reclamar automáticamente una identidad en Hito 2A. Reutilizar una identidad compartida requiere autorización explícita para los contextos necesarios o intervención técnica excepcional auditada. Sin cédula no se puede asegurar unicidad global por nombre y no se fusionan coincidencias de nombre.

El alta de Student y primera Enrollment es atómica; otra matrícula reutiliza el UUID. Los índices únicos y FK compuesta previenen duplicados y curso/año discordantes también bajo concurrencia; `rowVersion`, transacciones y auditoría protegen modificaciones. La desactivación de Student conserva matrículas y bloquea nuevas; reactivar no crea vínculos ni privilegios. La migración `20261005120000_student_enrollment` incorpora ambos modelos. La migración inicial ya contenía `Course_academic_year_institution_fkey`; se verificó en PostgreSQL y no se duplicó.

UX: se mantiene **Inicio → Institución → Curso → Materia → espacio de trabajo**, se añade **Institución → Curso → Estudiantes** y se enlaza desde **Materia → Perfiles de Alumnos** al mismo Student + Enrollment, mostrando solo la base disponible. Importación CSV/XLSX, consulta pública, módulos académicos, mallas, IA y RF-034 integral quedan fuera de Hito 2A. La evidencia ejecutada figura en [TESTS.md](../tests/TESTS.md).

## CUR-API-01 — Administración curricular y correspondencias

**Estado:** implementado y validado. **Fecha:** 25/09/2026. **Tipo:** precisión técnica del alcance V1.0, sin RF/RNF nuevos. No renumera ni reabre D-01 a D-07. Fuente normativa: REQUIREMENTS.md revisión 4 y DATABASE.md actualizado. Contratos completos: [API.md](API.md), sección “Contratos aprobados — Administración curricular”.

### Decisión de permisos

El catálogo conserva los 13 códigos originales y añade estos cuatro códigos recurso.acción, en singular y kebab-case:

| Código | Semántica |
|---|---|
| curriculum-catalog.read | Leer referencias compartidas desde un contexto autorizado. |
| curriculum-catalog.manage | Administrar catálogo compartido solo mediante autorización técnica excepcional. |
| subject-curriculum-mapping.read | Leer correspondencias dentro del ámbito institucional/curso permitido. |
| subject-curriculum-mapping.manage | Crear, retirar y sustituir correspondencias institucionales autorizadas. |

Los códigos están implementados en TypeScript y el bootstrap sincroniza 17 códigos/descripciones sin autorizar concesiones automáticas. El dataset demo usa una lista explícita de los 13 permisos anteriores. No usar el plural subject-curriculum-mappings para permisos (las rutas REST sí son plurales). manage no implica read; subject.manage no implica administración curricular.

### Catálogo compartido y límites de autorización

AccessScope pertenece a una institución. Ninguna concesión institucional autoriza una escritura global. La administración compartida requiere TECHNICAL, autorización explícita de acción excepcional, technicalReason, sesión, CSRF y auditoría. No se crea GLOBAL ni institución artificial; tampoco se permite delegar curriculum-catalog.manage por /authorization/grants ordinario. El código de permiso no sustituye la política técnica.

La implementación exige una concesión raíz explícita del permiso a la propia cuenta técnica, activa y con cadena efectiva. Una cuenta `TECHNICAL` sin esa concesión y un administrador ordinario al que se hubiese asignado el código son rechazados. El endpoint genérico de comprobación aplica la misma política y la delegación ordinaria rechaza el permiso.

RESOURCE_SET permanece no soportado. La escritura de correspondencias exige scope institucional completo; una concesión de curso permite solo lectura contextual autorizada. No puede alterar una correspondencia compartida por otras secciones/años. La futura autorización por Subject explícito del modelo no se implementa incidentalmente aquí.

### Modelo, historia y concurrencia

Subject es institucional y genérico. PlanType, AcademicArea y CurriculumDiscipline son compartidos; planTypeId es obligatorio y academicAreaId nullable. El área existente pertenece al mismo plan. No inventar áreas. Una correspondencia Subject + btiYear + disciplina puede existir sin malla. AcademicYear sigue distinto de btiYear.

Se mantiene una correspondencia vigente por materia/nivel. La sustitución retira la anterior y crea otra fila en una transacción con control de versión, unicidad parcial y auditoría. Retiro/reemplazo no borran historia ni cambian identidades. Correcciones que reinterpretarían clasificación usada se rechazan. Las futuras referencias AnnualPlan conservan su correspondencia y Curriculum concretos; no se exige crear esos modelos ahora.

### Contratos y compatibilidad HTTP

API.md define 13 rutas: tres lecturas de catálogo, seis escrituras excepcionales y cuatro operaciones de correspondencias. Se reutilizan AUTHENTICATION_REQUIRED, PERMISSION_DENIED, CSRF_TOKEN_INVALID, VALIDATION_ERROR y el formato error.requestId ya implementados. Los códigos específicos nuevos se documentan solo para las rutas nuevas; no se cambian los contratos del Hito 1.

### Disponibilidad de malla y UX

curriculumAvailability es contrato futuro. En este checkpoint se omite y la UI expresa disponibilidad aún no consultable. No implementar Curriculum/capacidades/contenidos/indicadores ni inventar filas o respuestas. Cuando exista fuente real se distinguirán NOT_AVAILABLE y VALIDATED_AVAILABLE por disciplina/nivel exactos.

Se conserva Inicio → Institución → Curso → Materia → espacio de trabajo. Crear materia no exige referencia. Conducta identifica comportamiento, Disciplina curricular la clasificación oficial. La asociación sin área es válida; no exige malla. Los estados definitivos de disponibilidad se habilitan cuando puedan comprobarse. La administración técnica no se convierte en trabajo cotidiano.

### Consecuencias y verificación

Hito 1 mantiene sus 16 entidades y recorrido, sin nuevas dependencias obligatorias. La estructura curricular ya implementada se reutiliza y no se repite la migración. La implementación no modificó REQUIREMENTS.md, DATABASE.md ni PROJECT_MASTER.md. La evidencia ejecutada se registra en [TESTS.md](../tests/TESTS.md).
