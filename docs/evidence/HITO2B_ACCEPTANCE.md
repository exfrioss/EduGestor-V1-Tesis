# EduGestor V1.0 — Acta de aceptación del Hito 2B

**Estado: ACEPTADO.**  
**Fecha de aceptación: 03/11/2026.**  
**Alcance:** Hito 2B-1, Hito 2B-2 y hardening posterior a auditoría.  
**Cierre estable informado:** `main` en `1574ab9`, tag `hito2b2-hardening-accepted-2026-11-03`.

**Ramas:**

- Hito 2B-1: `feat/hito2b-tasks-assessments`.
- Hito 2B-2: `feat/hito2b-grading-scale`.
- Hardening: `fix/hito2b2-audit-hardening`.
- Documentación: `docs/hito2b-acceptance`.

Esta acta reúne la especificación, los artefactos técnicos y las pruebas documentadas en `EduGestor-Hito2B-Acceptance-Context.zip`, junto con los metadatos Git y los resultados finales que el responsable del proyecto aportó como **verificados externamente**. La preparación de esta acta no ejecutó nuevamente las suites ni inspeccionó el repositorio completo. Los documentos del paquete registran hitos anteriores a la aceptación y cifras de pruebas de sus respectivas fechas; los resultados finales de hardening se consignan por separado.

## 1. Alcance entregado

| Etapa | Entrega funcional | Evidencia Git aportada |
|---|---|---|
| Hito 2B-1 | `ActivityBankItem`, `Task`, `Assessment` y `AssessmentResult`; banco privado, reutilización independiente, resultados y Proceso sin nota formal. | Implementación `27e46e8`; merge estable `8dd0227`; tag `hito2b1-accepted-2026-11-02`. |
| Hito 2B-2 | `GradingScale`, referencia de escala en `TeachingAssignment`, conversión y redondeo, nota formal y preview/confirmación de cambios de máximo y escala. | Implementación `5081397`; merge estable `c64f31c`; tag `hito2b2-accepted-2026-11-02`. |
| Hardening posterior a auditoría | Protección adicional de la historia de escalas usadas; validación final del conjunto. | Hardening `5e2a1de`; merge estable actual `1574ab9`; tag `hito2b2-hardening-accepted-2026-11-03`. |

### Hito 2B-1

- Tareas ordinarias y fuera de escala en una asignación docente; evaluaciones independientes o vinculadas opcionalmente a una tarea, sin contar dos veces la actividad.
- Resultados individuales para `Enrollment` compatible, con un registro por evaluación y matrícula; ausencia de resultado y `PENDIENTE` distintos del cero evaluado.
- Banco de actividades privado por docente; reutilización desde banco o actividades autorizadas mediante copia independiente, sin copiar estudiantes, resultados ni acceso al banco de origen.
- Vista **Tareas y Evaluaciones** y planilla **Proceso** con puntos ordinarios, adicionales, pendientes y porcentaje parcial; `formalGrade = null` durante este checkpoint.

### Hito 2B-2

- Escalas institucionales versionadas, selección explícita para la asignación y definiciones JSON validadas; conversión y redondeo con `Decimal`.
- Nota formal solo para cálculo con base ordinaria positiva, sin pendientes y con escala válida.
- Preview y confirmación de cambios de máximo en tarea o evaluación independiente, y de cambio de escala; advertencias, control de versión, auditoría y conservación de puntos obtenidos históricos.
- Interfaz para escala aplicada, nota y razón de ausencia de nota, porcentaje superior al 100 %, advertencias, confirmación o cancelación y manejo de preview vencida u obsoleta.

## 2. Hardening y persistencia

El paquete incluye la migración `20261103120000_grading_scale_historical_delete_guard/migration.sql`. Su trigger `GradingScale_preserve_used_history_trigger` impide borrar una escala con `lockedAt` informado o todavía referenciada por una asignación. La marca de uso permite conservar la versión histórica también cuando la asignación cambia después a otra escala. Esta protección complementa la inmutabilidad de la escala utilizada prevista en la migración de 2B-2. Los cierres adicionales se consignan conforme a la verificación externa aportada por el usuario.

**Cierres posteriores a la auditoría:**

- Ampliación de pruebas directas de los subcasos que habían quedado parcialmente acreditados.
- Mensajes diferenciados en UX para `CONFIRMATION_EXPIRED` y `STALE_PREVIEW`, que obligan a generar una nueva vista previa.
- Protección SQL contra `DELETE` de `GradingScale` históricamente utilizada.
- Redacción explícita en logging de `confirmationToken` y del material HMAC sensible.
- Correcciones de concurrencia detectadas por las nuevas pruebas.
- Validación final: **9 migraciones; PostgreSQL 121/121; web 19/19; E2E simulado 1/1; E2E real 5/5**.

| Modelo o relación | Integridad relevante |
|---|---|
| `ActivityBankItem` | Propiedad `ownerTeacherId`; tipo tarea/instrumento, contenido reutilizable, máximo sugerido y procedencia sin datos de estudiantes. |
| `Task` | Pertenece a `TeachingAssignment`; máximo y `scoringKind`; posible origen de banco o tarea; control `rowVersion`. |
| `Assessment` | Pertenece a la asignación; `taskId` opcional y único. Si es independiente, mantiene máximo y tipo propios; si está vinculada, hereda los de la tarea. |
| `AssessmentResult` | FK a `Assessment` y `Enrollment`; `UNIQUE(assessmentId, enrollmentId)`; estado `PENDIENTE`/`EVALUADO`, puntos y versión. Es la fuente persistida de resultados individuales, sin tabla duplicada de notas. |
| `GradingScale` | Institución, nombre, versión, límites, definiciones JSON, `lockedAt`, creador y `rowVersion`; `UNIQUE(institutionId, name, version)`. Una versión usada queda inmutable. |
| `TeachingAssignment.gradingScaleId` | FK nullable a escala de la **misma institución**; la asignación conserva `rowVersion` para cambios concurrentes. |

Todos los identificadores internos de estos modelos son UUID. El cálculo toma matrículas reales de Hito 2A y comprueba que evaluación, tarea, asignación, curso, año lectivo y matrícula sean compatibles. Se preservan resultados y versiones históricos; las notas derivadas no se persisten en otra tabla.

| Número en el historial | Migración | Efecto para este hito |
|---|---|---|
| 1–6 | Preexistentes antes de Hito 2B | Base de Hito 1, currículo y Hito 2A. El paquete de aceptación no contiene sus seis archivos SQL, por lo que aquí no se atribuyen cambios individuales. |
| 7 | `20261006120000_hito2b1_tasks_assessments` | Cuatro modelos de actividad, tarea, evaluación y resultado; claves, índices, unicidades, checks y protección de contexto. |
| 8 | `20261102120000_hito2b2_grading_scale` | Escala, FK institucional en asignación, unicidad/versionado y protección de versiones usadas; habilitación transaccional del cambio confirmado de máximo. |
| 9 | `20261103120000_grading_scale_historical_delete_guard` | Bloqueo de borrado de escalas usadas para conservar historia. |

El estado final de **nueve migraciones** procede del cierre técnico verificado externamente. Los archivos SQL 7, 8 y 9 están incluidos en el ZIP; no se reconstruyen las seis migraciones previas a partir de este paquete.

## 3. Permisos y protección del contexto

Hito 2B incorporó diez permisos con la convención existente `recurso.acción`. Ocho corresponden a 2B-1 y dos a 2B-2; el catálogo técnico del paquete llega a 31 permisos en total. Su sincronización es idempotente y estos permisos no se conceden automáticamente al demo ni por inferencia del rol.

| Recurso | Lectura | Administración | Checkpoint |
|---|---|---|---|
| Banco privado | `activity-bank.read` | `activity-bank.manage` | 2B-1 |
| Tarea | `task.read` | `task.manage` | 2B-1 |
| Evaluación | `assessment.read` | `assessment.manage` | 2B-1 |
| Resultado | `assessment-result.read` | `assessment-result.manage` | 2B-1 |
| Escala | `grading-scale.read` | `grading-scale.manage` | 2B-2 |

Las operaciones docentes exigen usuario y docente activos, asignación propia vigente, permiso efectivo y scope del recurso resuelto en el servidor. El banco pertenece exclusivamente al docente propietario, incluso frente a otro docente o una cuenta administrativa cotidiana con acceso institucional. Una escala se consulta o administra dentro de su institución; cambiar la escala de una asignación exige además `teaching-assignment.manage` efectivo. Un UUID válido de otro contexto no confiere acceso ni revela datos ajenos. Las mutaciones exigen sesión y protección CSRF, se reautorizan al confirmar y generan auditoría de éxito dentro de la transacción; logs y auditoría omiten secretos y tokens.

## 4. Proceso académico y D-03

Para cada estudiante matriculado y conjunto de actividades elegibles de la asignación:

- `D = ordinaryPossible`: suma de máximos de actividades `ORDINARIA`, incluso con resultado pendiente.
- `O = ordinaryEarned`: puntos ordinarios evaluados obtenidos.
- `X = extraEarned`: puntos evaluados `FUERA_DE_ESCALA`; sus máximos **no** aumentan `D`.
- `T = O + X`; si `D > 0`, `percentage = T / D × 100`; si `D = 0`, `percentage = null`.

Una tarea con evaluación vinculada cuenta como **una** actividad. Un resultado ausente o `PENDIENTE` no se transforma en cero; `EVALUADO` con `earnedPoints = 0` sí es un cero real. Mientras haya una actividad elegible pendiente, el porcentaje numérico, si existe, se presenta como **parcial** y `formalGrade = null`. `pendingCount`, `hasPending` e `isPartial` reflejan pendientes también cuando `D = 0`.

La razón para `formalGrade = null` sigue este orden: `D = 0` → `NO_ORDINARY_BASE`; con `D > 0` y pendientes → `PENDING_RESULTS`; sin pendientes y sin escala completa válida → `NO_VALID_SCALE`; con nota calculable → `null`. Solo se emite nota cuando `D > 0`, no hay pendientes y existe escala válida asignada. Por ejemplo, `D=20`, `O=20`, `X=3` da `T=23` y `115 %`; la nota formal corresponde al máximo **de la escala configurada**, nunca lo supera. No se define una escala universal.

## 5. Escala, precisión y cambios confirmados

`GradingScale.conversionDefinition` admite en este checkpoint el esquema discriminado `schemaVersion: 1`, `kind: PERCENTAGE_BANDS`: bandas configuradas por la institución, primera desde 0, umbrales estrictamente crecientes dentro de 0..100, notas no decrecientes dentro de `minimumGrade..maximumGrade`, sin propiedades desconocidas, definiciones mayores de 16 KiB ni más de 256 bandas. `roundingDefinition` acepta `NONE` o `DECIMAL_PLACES` con `HALF_UP`, `HALF_EVEN` o `TOWARD_ZERO` y precisión permitida. Los valores decimales externos son strings canónicos convertidos a `Decimal`, sin aritmética académica en coma flotante binaria. La banda se elige con el porcentaje no redondeado; luego se redondea la nota convertida y se limita al intervalo de la escala. Si el porcentaje supera 100, la nota es `maximumGrade`. Una definición usada no se sobrescribe: se crea otra versión y el cambio de asignación es explícito.

Cuando un máximo ya tiene resultados, la preview muestra antes/después, advertencias, resultados afectados y posibles puntos históricos por encima del nuevo máximo. Confirmar no modifica `earnedPoints`: solo cambia el máximo y recalcula derivados; la nueva captura o corrección sí respeta el máximo vigente. Sin resultados, el cambio exige `expectedVersion` y volver a comprobar su ausencia en la transacción. Para evaluación vinculada, el máximo se cambia mediante la tarea. El cambio de escala presenta también antes/después y conserva la definición histórica de la versión anterior.

El `confirmationToken` tiene forma `base64url(payloadCanónico).base64url(HMAC-SHA-256(payloadCanónico, claveDelKid))`, firma comprobada en tiempo constante y **TTL de cinco minutos**. El payload contiene versión de contrato, `kid`, propósito, actor, sesión, institución, asignación, recurso, versiones esperadas, valores anterior/nuevo, `contextDigest`, tiempos de emisión/expiración y nonce aleatorio de al menos 128 bits. La clave HMAC se configura para compartirse entre instancias; no se guarda el token ni el nonce en base de datos o memoria del proceso.

Al aplicar, se comprueban sesión, CSRF, permisos, scope, firma, propósito, identidad, valores, versiones y snapshot transaccional. `contextDigest` cubre actividades y vínculos, máximos/tipos, matrículas elegibles, resultados existentes o ausentes, y escalas anterior/nueva. Un cambio de contexto desde la preview devuelve `409 STALE_PREVIEW`; un token vencido, `409 CONFIRMATION_EXPIRED`; token alterado o para otro actor/sesión/recurso/valor, `INVALID_CONFIRMATION`. Tras un éxito, el cambio de versión invalida su reutilización. La prueba real entre **dos procesos API** del paquete muestra emisión en uno y aplicación en el otro con clave compartida, replay rechazado y previews invalidadas por cambios de resultado, matrícula o tarea.

## 6. Experiencia de usuario

Se conserva **Inicio → Institución → Curso → Materia → espacio de trabajo**, sobre `Enrollment` real. **Materia → Tareas y Evaluaciones** permite crear tareas, evaluaciones independientes o vinculadas, consultar y reutilizar el banco propio, registrar o corregir resultados, diferenciar pendiente de cero y distinguir puntos ordinarios/adicionales. **Materia → Proceso** presenta una actividad una sola vez, `D/O/X/T`, porcentaje parcial cuando corresponde, nota formal calculable o razón de ausencia de nota. El porcentaje superior a 100 % permanece visible.

La interfaz muestra la escala aplicada y, según permisos, su configuración/selección de versión. Los cambios de máximo y escala presentan una preview con resultados afectados, excedentes históricos y advertencias, y permiten confirmar o cancelar. La expiración u obsolescencia obliga a obtener una preview nueva. Los controles visuales no sustituyen la autorización del servidor ni hacen que gestionar escalas sea una capacidad implícita del docente.

## 7. Evidencia de ejecución y regresión

| Momento y procedencia | Migraciones / base | API PostgreSQL | Web | E2E | Otros controles |
|---|---|---|---|---|---|
| 2B-1, `TESTS.md` del paquete | 7 desde base vacía; `prisma validate/generate`, `migrate deploy/status` | 97/97 | 14/14 | Simulado 1/1; real 4/4 | Shared 1/1; typecheck y build aprobados. |
| 2B-2, `TESTS.md` del paquete | 8 desde base temporal vacía; `prisma validate/generate` | 103/103 | 15/15 | Real adicional de dos instancias 1/1, repetido con éxito | Typecheck y build de tres paquetes aprobados. |
| Cierre tras auditoría, **metadatos finales aportados y verificados externamente por el usuario** | 9 migraciones | **121/121** | **19/19** | Simulado **1/1**; real final **5/5** | Regresiones reales de Hito 1, currículo, 2A, 2B-1 y 2B-2; working tree final de `main` limpio. |

Los recuentos de 97/97 y 103/103 son ejecuciones históricas documentadas, no sustituyen ni se suman al resultado final 121/121. El E2E adicional 1/1 de 2B-2 prueba específicamente interoperabilidad entre instancias y no se suma aritméticamente al 5/5 final. Este documento no afirma haber ejecutado una prueba nueva. El cierre externo informa asimismo que el hardening no modificó `REQUIREMENTS.md`, `DATABASE.md` ni `PROJECT_MASTER.md`.

### Síntesis de la matriz B-01 a B-27

La siguiente tabla resume la matriz y las secciones de ejecución de `TESTS.md`. «2B-1» y «2B-2» señalan dónde se documentó el subcaso; el cierre posterior confirma la regresión global, sin adjudicar números adicionales por caso.

| Caso | Cobertura documentada | Ejecución documentada |
|---|---|---|
| B-01 | Tarea ordinaria y denominador aun pendiente. | 2B-1. |
| B-02 | Extra al numerador, nunca al denominador. | 2B-1. |
| B-03 | Evaluación independiente con máximo propio. | 2B-1. |
| B-04 | Evaluación vinculada, una sola actividad. | 2B-1. |
| B-05 | Tarea elegible sin resultado; primer vínculo atómico. | 2B-1. |
| B-06 | Ausente/pendiente frente a cero evaluado. | 2B-1; efecto formal en 2B-2. |
| B-07 | `T/D = (20+3)/20 = 115 %`, tope de nota formal. | Cálculo 2B-1; nota 2B-2. |
| B-08 | Base cero, parcialidad y desbloqueo al completar. | 2B-1 y 2B-2. |
| B-09 | JSON de escala, Decimal, límites y redondeos. | 2B-2. |
| B-10 | Resultado único y escrituras concurrentes. | 2B-1. |
| B-11 | Matrícula incompatible e historia. | 2B-1. |
| B-12 | Carrera del primer resultado por tarea. | 2B-1. |
| B-13 | Privacidad del banco frente a terceros. | 2B-1. |
| B-14 | Copia independiente sin resultados ni estudiantes. | 2B-1. |
| B-15 | Rechazo de banco, origen o destino ajeno. | 2B-1. |
| B-16 | Bloqueo inicial y preview/confirmación de máximo. | Bloqueo 2B-1; flujo completo 2B-2. |
| B-17 | Reducción confirmada, excedente conservado y auditoría. | 2B-2. |
| B-18 | Firma, caducidad, replay, digest y dos instancias. | 2B-2, incluido E2E real adicional. |
| B-19 | Compatibilidad de vínculo y máximo de vinculada por tarea. | 2B-1 y 2B-2. |
| B-20 | Inactividad impide capturas nuevas; historia legible. | 2B-1. |
| B-21 | Escala versionada/inmutable y cambio autorizado. | 2B-2; protección histórica reforzada por migración 9. |
| B-22 | Sesión, CSRF, permisos, scope y aislamiento. | 2B-1; escala en 2B-2. |
| B-23 | UI de tareas, resultados, banco y confirmaciones. | 2B-1; confirmaciones 2B-2. |
| B-24 | UI Proceso, parcialidad y nota condicionada. | 2B-1; nota/escala 2B-2. |
| B-25 | Recorrido y permisos de Hito 1. | Regresión real 2B-1/2B-2; cierre final informado. |
| B-26 | Catálogo y correspondencias curriculares. | Regresión real 2B-1/2B-2; cierre final informado. |
| B-27 | Student/Enrollment y aislamiento de Hito 2A. | Regresión real 2B-1/2B-2; cierre final informado. |

## 8. Incidencias resueltas y límites

- En 2B-1, las primeras pruebas hallaron expectativas antiguas de 21 permisos, fixtures compartidos en el cálculo y selectores RTL ambiguos; se corrigieron antes de los resultados documentados. Se reprovisionaron credenciales ficticias del demo aislado para repetir los cuatro E2E reales.
- En la validación E2E de dos instancias de 2B-2, fallaron inicialmente una expectativa de navegación y un selector `<dt>/<dd>` de la prueba. Tras corregir expectativas/selectores, dos ejecuciones finales aprobaron 1/1. Los cambios de resultados, matrícula y tarea entre preview y confirmación devolvieron `STALE_PREVIEW` sin modificar el máximo; el replay devolvió `STALE_VERSION`.
- El hardening del 03/11 añadió la guarda SQL de borrado para escalas históricamente utilizadas. El estado final de pruebas y migraciones se informa mediante la evidencia externa del usuario; el ZIP no trae el informe desglosado de cada una de las 121 pruebas finales ni las primeras seis migraciones.

Quedaron fuera de Hito 2B asistencia, registros anecdóticos, Conducta, informes grupales, consulta pública, importación CSV/XLSX, planificación, mallas curriculares completas, IA pedagógica y el perfil académico integral de RF-034. No se presentan esos módulos como implementados por esta aceptación.

## 9. Trazabilidad normativa y conclusión

`REQUIREMENTS.md` del paquete contiene **RF-009 a RF-014** y **D-03 resuelta**. La correspondencia comprobada es:

| Referencia | Evidencia de Hito 2B |
|---|---|
| RF-009 — Tareas | Tareas por asignación, puntaje, autorización y cambio confirmado de máximo con auditoría. |
| RF-010 — Puntos fuera de escala | Diferenciación ordinario/adicional, `X` fuera de `D` y porcentaje superior a 100 % con tope formal. |
| RF-011 — Banco de actividades | Contenido reutilizable privado del docente, sin resultados ni datos de alumnos. |
| RF-012 — Reutilización | Copia independiente y procedencia opcional, sin trasladar resultados ni permisos. |
| RF-013 — Evaluaciones | Independientes o vinculadas opcionalmente, resultado único por matrícula, pendiente distinto de cero y cambio de máximo confirmado. |
| RF-014 — Calificaciones y planilla | Proceso derivado, escala configurable, nota condicionada y cálculo reproducible sin escala fija. |
| D-03 — Calificaciones | Denominador ordinario, adicionales solo al numerador, porcentaje >100 %, nota limitada, pendientes conservados y cambios confirmados/auditados. |

Las evidencias documentales del paquete, las tres migraciones pertinentes incluidas y los metadatos de Git y de validación final aportados como verificados externamente respaldan el cierre. Se mantiene la distinción entre pruebas históricas del ZIP y cifras finales externas; esta acta no sustituye un log de ejecución ni certifica de forma independiente el estado remoto de `main`.

**HITO 2B — ACEPTADO, VALIDADO Y ENDURECIDO**

### Fuentes utilizadas

- `EduGestor-Hito2B-Acceptance-Context.zip`: `REQUIREMENTS.md` (RF-009 a RF-014 y D-03), `DATABASE.md`, `API.md`, `DECISIONS.md`, `PROJECT_CONTEXT.md`, `CHANGELOG.md`, `TESTS.md`.
- Del mismo paquete: `schema.prisma`, `permission-catalog.ts`, migraciones SQL 7, 8 y 9, archivos de servicio/validación de grading, `grading-real.spec.ts`, componentes de escala/confirmación y `logger.ts`.
- Metadatos Git, conteos de suites, regresiones y estado final de `main` proporcionados por el usuario como verificados externamente en esta solicitud.
