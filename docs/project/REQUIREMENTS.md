# EduGestor — Especificación de requisitos V1.0

**Proyecto:** aplicación de gestión docente para tesis.  
**Versión:** 1.0.  
**Revisión documental:** 2 — correcciones de alcance y consistencia solicitadas.  
**Estado:** línea base funcional aprobada; decisiones de detalle pendientes según sección 7.  
**Fecha:** 21 de septiembre de 2026.  
**Archivo de destino:** `REQUIREMENTS.md`.

## 1. Propósito y alcance

Este documento formaliza los requisitos funcionales y no funcionales de EduGestor V1.0, sus actores, prioridades, dependencias y criterios de aceptación.

La V1.0 utilizará una arquitectura modular cliente-servidor. El prototipo anterior constituye una referencia funcional; su implementación y sus limitaciones técnicas no determinan la nueva arquitectura.

El alcance funcional está congelado. Las decisiones pendientes de este documento precisan reglas de funcionalidades ya incluidas y no autorizan funcionalidades adicionales.

Los entregables obligatorios son:

1. Aplicación EduGestor V1.0.
2. Manual de Usuario.
3. Manual Técnico.
4. Documentación completa de la tesis.

### 1.1. Límite curricular

La base curricular inicial comprende exclusivamente:

- Matemática Aplicada: 1.º, 2.º y 3.º BTI.
- Algorítmica: 1.º, 2.º y 3.º BTI.

La arquitectura deberá permitir incorporar otras materias posteriormente, pero esa incorporación no forma parte de la carga curricular comprometida para V1.0.

### 1.2. Exclusiones

No forman parte de esta especificación:

- Importación universal de cualquier malla curricular.
- Incorporación de nuevas funcionalidades no contempladas en el alcance congelado.
- Publicación o aplicación automática de propuestas pedagógicas generadas por IA sin aprobación docente.
- Calificación automática mediante IA de fotografías de exámenes.
- Migración automática del prototipo: no se presupone incluida por el hecho de existir una aplicación anterior.

## 2. Convenciones

### 2.1. Prioridades

| Prioridad | Significado |
|---|---|
| P0 | Fundamento del sistema, integridad de datos, seguridad o funcionamiento académico esencial. |
| P1 | Funcionalidad comprometida de V1.0 que se implementa sobre los fundamentos P0. |
| P2 | Cierre operativo, presentación o documentación comprometida para la entrega. |

**Todas las prioridades forman parte de V1.0.** La prioridad organiza la implementación; no convierte un requisito en opcional.

### 2.2. Criterios y dependencias

- Cada requisito tiene un identificador único.
- Sus criterios se identifican como `RF-001-CA1`, `RNF-001-CA1`, etc.
- Las dependencias indican requisitos necesarios para satisfacer el comportamiento descrito.
- Los requisitos no funcionales se aplican transversalmente donde corresponda.
- «Sin dependencia funcional previa» identifica un requisito raíz, no un requisito huérfano.
- Las decisiones pendientes `D-01`, `D-02`, `D-03`, `D-05`, `D-06` y `D-07` deben resolverse antes de aceptar los comportamientos afectados. `D-04` queda resuelta y se conserva como decisión documentada.

### 2.3. Activación, desactivación y conservación histórica

Esta regla se aplica a instituciones, docentes, cursos, materias y estudiantes mediante RF-003, RF-004, RF-005, RF-006 y RF-008.

- Cada entidad tendrá estado activo o inactivo, modificable únicamente por un usuario autorizado.
- Desactivar no elimina la entidad, sus vínculos ni sus registros históricos. El historial sigue disponible para consulta e impresión por usuarios que conserven autorización.
- Una entidad inactiva no podrá seleccionarse para crear nuevas asignaciones, vinculaciones o registros operativos que la requieran activa. Una institución, curso o materia inactivos impiden nuevas operaciones en ese ámbito, sin cambiar en cascada los estados propios de sus entidades relacionadas.
- Desactivar un docente impide nuevos inicios de sesión y el uso de sus sesiones existentes para acceder a recursos privados; conserva su autoría histórica.
- Reactivar conserva los mismos identificadores e historial. No concede permisos nuevos ni reactiva automáticamente otras entidades.
- Se rechazará la eliminación física de cualquiera de estas entidades cuando existan relaciones históricas, incluso mediante solicitudes directas a la API. Esta regla no incorpora una funcionalidad adicional de eliminación.

## 3. Actores

| ID | Actor | Responsabilidad y límite |
|---|---|---|
| ACT-01 | Administración | Gestiona la estructura institucional, docentes y asignaciones, y realiza las operaciones administrativas autorizadas. Su alcance institucional exacto se determina en D-01. |
| ACT-02 | Docente | Gestiona el trabajo académico y pedagógico correspondiente a sus asignaciones Docente–Curso–Materia. |
| ACT-03 | Consultante público | Consulta por cédula únicamente la información expresamente habilitada para exposición pública. No modifica datos. |
| ACT-04 | Responsable técnico | Instala, configura, mantiene, respalda y restaura el sistema mediante procedimientos autorizados. No implica un rol adicional en la interfaz. |
| ACT-05 | OpenAI API | Servicio externo utilizado por el backend para las funciones del asistente pedagógico. No tiene acceso directo autónomo a la base de datos. |

Los estudiantes son entidades gestionadas. Esta especificación no presupone cuentas de acceso para estudiantes o familiares.

## 4. Requisitos funcionales

### 4.1. Acceso y estructura institucional

#### RF-001 — Autenticación y sesión

**Prioridad:** P0.  
**Actores:** ACT-01, ACT-02.  
**Dependencias:** sin dependencia funcional previa.

El sistema deberá permitir iniciar y cerrar sesión mediante credenciales individuales.

**Criterios de aceptación:**

- **CA1:** unas credenciales válidas permiten acceder al área privada correspondiente al usuario.
- **CA2:** unas credenciales incorrectas rechazan el acceso sin revelar si el identificador corresponde a una cuenta existente.
- **CA3:** después de cerrar sesión, la sesión utilizada deja de autorizar solicitudes privadas.
- **CA4:** una solicitud sin sesión válida a un recurso privado es rechazada sin devolver su contenido.
- **CA5:** las credenciales de un docente desactivado no permiten iniciar sesión y sus sesiones anteriores dejan de autorizar solicitudes privadas.

#### RF-002 — Control de acceso por rol y asignación

**Prioridad:** P0.  
**Actores:** ACT-01, ACT-02.  
**Dependencias:** RF-001.

El sistema deberá autorizar las operaciones según el rol y, para el docente, sus asignaciones Docente–Curso–Materia.

**Criterios de aceptación:**

- **CA1:** un docente puede operar sobre una combinación Docente–Curso–Materia autorizada.
- **CA2:** al modificar identificadores en una solicitud directa a la API, el docente no puede leer ni modificar información de una asignación ajena.
- **CA3:** una operación administrativa solicitada por un docente se rechaza.
- **CA4:** al retirarse una asignación, las solicitudes posteriores del docente a ese ámbito dejan de autorizarse.
- **CA5:** los permisos de Administración coinciden con la matriz institucional definida en D-01.

#### RF-003 — Gestión de instituciones

**Prioridad:** P0.  
**Actores:** ACT-01.  
**Dependencias:** RF-002.

El sistema deberá permitir registrar, consultar, actualizar, activar y desactivar las instituciones comprendidas en el ámbito autorizado.

**Criterios de aceptación:**

- **CA1:** una institución registrada puede recuperarse posteriormente con los datos guardados.
- **CA2:** una actualización modifica únicamente la institución seleccionada.
- **CA3:** los cursos y registros vinculados mantienen su pertenencia institucional después de actualizar sus datos.
- **CA4:** no se permite acceder a otra institución fuera del ámbito autorizado.
- **CA5:** un usuario autorizado puede desactivar y reactivar la entidad de tipo institución; cada cambio se conserva después de recargar la aplicación.
- **CA6:** la desactivación conserva los identificadores, vínculos e historial, permite su consulta e impresión autorizadas y bloquea los usos nuevos definidos en la sección 2.3.
- **CA7:** intentar eliminar físicamente la entidad con relaciones históricas es rechazado, sin borrar la entidad ni sus registros.
- **CA8:** la reactivación recupera la disponibilidad de la misma entidad conforme a los demás estados y permisos vigentes, sin duplicar registros ni reactivar entidades relacionadas.

#### RF-004 — Gestión de docentes y sus cuentas

**Prioridad:** P0.  
**Actores:** ACT-01.  
**Dependencias:** RF-003.

El sistema deberá permitir registrar, consultar, actualizar, activar y desactivar docentes y vincularlos con sus cuentas de acceso e instituciones.

**Criterios de aceptación:**

- **CA1:** un docente registrado queda vinculado a la cuenta y al ámbito institucional correspondientes.
- **CA2:** no se pueden crear dos cuentas con el mismo identificador de acceso.
- **CA3:** actualizar los datos del docente conserva sus asignaciones y registros académicos existentes.
- **CA4:** el alta de un docente permite establecer sus credenciales mediante el procedimiento definido en D-01, sin exponer contraseñas almacenadas.
- **CA5:** un usuario autorizado puede desactivar y reactivar la entidad de tipo docente; cada cambio se conserva después de recargar la aplicación.
- **CA6:** la desactivación conserva los identificadores, vínculos e historial, permite su consulta e impresión autorizadas y bloquea los usos nuevos definidos en la sección 2.3.
- **CA7:** intentar eliminar físicamente la entidad con relaciones históricas es rechazado, sin borrar la entidad ni sus registros.
- **CA8:** la reactivación recupera la disponibilidad de la misma entidad conforme a los demás estados y permisos vigentes, sin duplicar registros ni reactivar entidades relacionadas.
- **CA9:** desactivar al docente bloquea sus credenciales y sesiones existentes, sin retirar su identificación como autor de registros previos.

#### RF-005 — Gestión de cursos

**Prioridad:** P0.  
**Actores:** ACT-01.  
**Dependencias:** RF-003.

El sistema deberá permitir registrar, consultar, actualizar, activar y desactivar cursos asociados a una institución y al contexto académico correspondiente.

**Criterios de aceptación:**

- **CA1:** cada curso registrado identifica inequívocamente su institución y el contexto académico definido en D-02.
- **CA2:** los cursos de distintos contextos académicos no mezclan estudiantes ni registros.
- **CA3:** actualizar los datos de un curso conserva sus relaciones existentes.
- **CA4:** un usuario autorizado puede desactivar y reactivar la entidad de tipo curso; cada cambio se conserva después de recargar la aplicación.
- **CA5:** la desactivación conserva los identificadores, vínculos e historial, permite su consulta e impresión autorizadas y bloquea los usos nuevos definidos en la sección 2.3.
- **CA6:** intentar eliminar físicamente la entidad con relaciones históricas es rechazado, sin borrar la entidad ni sus registros.
- **CA7:** la reactivación recupera la disponibilidad de la misma entidad conforme a los demás estados y permisos vigentes, sin duplicar registros ni reactivar entidades relacionadas.

#### RF-006 — Gestión de materias

**Prioridad:** P0.  
**Actores:** ACT-01.  
**Dependencias:** RF-003.

El sistema deberá permitir registrar, consultar, actualizar, activar y desactivar materias para utilizarlas en las asignaciones académicas.

**Criterios de aceptación:**

- **CA1:** una materia registrada puede seleccionarse al crear una asignación válida.
- **CA2:** actualizar su denominación no rompe las relaciones con tareas, evaluaciones o planificaciones.
- **CA3:** Matemática Aplicada y Algorítmica pueden identificarse de forma diferenciada.
- **CA4:** un usuario autorizado puede desactivar y reactivar la entidad de tipo materia; cada cambio se conserva después de recargar la aplicación.
- **CA5:** la desactivación conserva los identificadores, vínculos e historial, permite su consulta e impresión autorizadas y bloquea los usos nuevos definidos en la sección 2.3.
- **CA6:** intentar eliminar físicamente la entidad con relaciones históricas es rechazado, sin borrar la entidad ni sus registros.
- **CA7:** la reactivación recupera la disponibilidad de la misma entidad conforme a los demás estados y permisos vigentes, sin duplicar registros ni reactivar entidades relacionadas.

La gestión genérica de materias no amplía el límite curricular de la sección 1.1.

#### RF-007 — Asignación Docente–Curso–Materia

**Prioridad:** P0.  
**Actores:** ACT-01.  
**Dependencias:** RF-004, RF-005, RF-006.

El sistema deberá permitir crear, consultar y modificar las asignaciones que determinan el ámbito académico del docente.

**Criterios de aceptación:**

- **CA1:** una asignación vincula un docente, un curso y una materia existentes y compatibles con su ámbito institucional.
- **CA2:** no se permite duplicar la misma asignación dentro del mismo contexto académico.
- **CA3:** el docente visualiza las asignaciones autorizadas al acceder a su área de trabajo.
- **CA4:** modificar o retirar una asignación no elimina los registros históricos asociados.
- **CA5:** no se crea una asignación nueva si el docente, la institución, el curso o la materia están inactivos; las asignaciones históricas se conservan.

#### RF-008 — Gestión de estudiantes y vinculación a cursos

**Prioridad:** P0.  
**Actores:** ACT-01, ACT-02, según permisos.  
**Dependencias:** RF-005, RF-007.

El sistema deberá permitir registrar, consultar, actualizar, activar y desactivar estudiantes, y mantener su vinculación con los cursos correspondientes.

**Criterios de aceptación:**

- **CA1:** un estudiante vinculado a un curso aparece en sus listados académicos autorizados.
- **CA2:** actualizar sus datos personales conserva las evaluaciones, asistencias y registros asociados.
- **CA3:** se detectan duplicidades conforme a la regla de identificación definida en D-02.
- **CA4:** el docente no puede gestionar estudiantes de cursos fuera de sus asignaciones.
- **CA5:** un usuario autorizado puede desactivar y reactivar la entidad de tipo estudiante; cada cambio se conserva después de recargar la aplicación.
- **CA6:** la desactivación conserva los identificadores, vínculos e historial, permite su consulta e impresión autorizadas y bloquea los usos nuevos definidos en la sección 2.3.
- **CA7:** intentar eliminar físicamente la entidad con relaciones históricas es rechazado, sin borrar la entidad ni sus registros.
- **CA8:** la reactivación recupera la disponibilidad de la misma entidad conforme a los demás estados y permisos vigentes, sin duplicar registros ni reactivar entidades relacionadas.

### 4.2. Actividades, evaluaciones y calificaciones

#### RF-009 — Gestión de tareas

**Prioridad:** P0.  
**Actores:** ACT-02.  
**Dependencias:** RF-007.

El sistema deberá permitir crear, consultar y modificar tareas vinculadas a una asignación académica, con su descripción y puntuación correspondiente.

**Criterios de aceptación:**

- **CA1:** una tarea guardada se recupera con su descripción, puntuación y asignación.
- **CA2:** no se puede crear una tarea en una asignación ajena.
- **CA3:** una modificación de puntuación incompatible con resultados ya registrados se rechaza o se resuelve según la regla explícita de D-03, sin producir inconsistencias.

#### RF-010 — Puntos fuera de escala

**Prioridad:** P0.  
**Actores:** ACT-02.  
**Dependencias:** RF-009.

El sistema deberá permitir identificar tareas cuyos puntos se suman como adicionales sin incrementar la escala base.

**Criterios de aceptación:**

- **CA1:** una tarea fuera de escala se distingue visualmente de una tarea ordinaria.
- **CA2:** con una escala base de 20 puntos, 15 puntos ordinarios obtenidos y 3 puntos adicionales obtenidos, el sistema conserva la escala base en 20 y muestra 18 puntos acumulados.
- **CA3:** los listados distinguen puntos ordinarios y adicionales.
- **CA4:** la conversión del acumulado a una calificación, incluido cualquier límite, sigue D-03; no se aplica una regla implícita.

#### RF-011 — Banco de actividades

**Prioridad:** P1.  
**Actores:** ACT-02.  
**Dependencias:** RF-007.

El sistema deberá permitir guardar y consultar actividades reutilizables, incluidas tareas e instrumentos de evaluación.

**Criterios de aceptación:**

- **CA1:** una actividad guardada en el banco puede recuperarse posteriormente con su contenido.
- **CA2:** las entradas del banco no contienen calificaciones, asistencias ni datos personales de estudiantes.
- **CA3:** cada docente accede únicamente a las entradas permitidas por la política de acceso definida en D-01.

#### RF-012 — Reutilización de tareas y evaluaciones

**Prioridad:** P1.  
**Actores:** ACT-02.  
**Dependencias:** RF-009, RF-011, RF-013.

El sistema deberá permitir reutilizar tareas e instrumentos de evaluación existentes o almacenados en el banco dentro de una asignación autorizada.

**Criterios de aceptación:**

- **CA1:** reutilizar un elemento genera una instancia independiente en la asignación de destino.
- **CA2:** modificar la instancia nueva no modifica el elemento de origen.
- **CA3:** la copia no incorpora estudiantes evaluados, puntuaciones obtenidas ni calificaciones previas.
- **CA4:** una tarea reutilizada conserva su condición de ordinaria o fuera de escala, pudiendo revisarse antes de utilizarla.

#### RF-013 — Gestión de evaluaciones

**Prioridad:** P0.  
**Actores:** ACT-02.  
**Dependencias:** RF-007, RF-008. RF-009 o RF-011 solo cuando se vincule una tarea, actividad o instrumento procedente de esos módulos.

El sistema deberá permitir definir evaluaciones directamente dentro de una asignación y registrar o corregir los resultados individuales de los estudiantes del curso. La vinculación a una tarea, actividad o instrumento será opcional, cuando corresponda; no se exigirá una tarea previa.

**Criterios de aceptación:**

- **CA1:** puede crearse y consultarse una evaluación dentro de una asignación autorizada sin tareas previas ni actividad o instrumento vinculado.
- **CA2:** un estudiante sin resultado registrado aparece como pendiente, sin asignarle automáticamente cero.
- **CA3:** guardar un resultado cambia el estado correspondiente a evaluado.
- **CA4:** corregir un resultado actualiza el registro existente sin generar un segundo resultado para la misma evaluación y estudiante.
- **CA5:** no se admite evaluar a un estudiante ajeno al curso correspondiente.
- **CA6:** si se vincula una tarea, actividad o instrumento, el sistema comprueba su existencia, compatibilidad con el contexto y permisos de acceso.
- **CA7:** una evaluación sin vínculo opcional admite resultados, estado pendiente/evaluado y cálculo de calificaciones igual que una evaluación vinculada.

#### RF-014 — Calificaciones y planilla académica

**Prioridad:** P0.  
**Actores:** ACT-02.  
**Dependencias:** RF-010, RF-013.

El sistema deberá presentar los resultados y calcular las calificaciones según las reglas académicas definidas.

**Criterios de aceptación:**

- **CA1:** la planilla distingue resultados pendientes, puntuaciones ordinarias y puntos fuera de escala.
- **CA2:** los casos de prueba de D-03 producen exactamente las calificaciones esperadas, incluidos límites y redondeos.
- **CA3:** corregir un resultado actualiza los totales y la calificación que dependen de él.
- **CA4:** para el mismo estudiante y contexto, los valores coinciden en la planilla y en los informes que los incluyan.

### 4.3. Asistencia y seguimiento del estudiante

#### RF-015 — Registro de asistencia

**Prioridad:** P0.  
**Actores:** ACT-02.  
**Dependencias:** RF-007, RF-008.

El sistema deberá permitir registrar, consultar y corregir la asistencia por fecha, con estado, justificación como atributo complementario y observaciones.

**Criterios de aceptación:**

- **CA1:** un registro conserva estudiante, fecha, contexto académico, estado, atributo de justificación y observación cuando se indique.
- **CA2:** corregir la asistencia actualiza el registro correspondiente sin duplicarlo.
- **CA3:** una fecha sin registros no se interpreta automáticamente como ausencia de todos los estudiantes.
- **CA4:** los estados mínimos disponibles son `PRESENTE`, `AUSENTE`, `LLEGADA_TARDIA` y `SALIDA_ANTICIPADA`; la unidad de registro coincide con D-02.
- **CA5:** la justificación se guarda separadamente del estado y admite una observación complementaria; no existe un estado sustitutivo denominado «JUSTIFICADO».
- **CA6:** marcar como justificada una ausencia conserva `AUSENTE`; justificar una llegada tardía conserva `LLEGADA_TARDIA`. Al consultar e imprimir se muestran el estado y la justificación de forma diferenciada.
- **CA7:** pueden guardarse y recuperarse registros de prueba con cada uno de los cuatro estados mínimos; modificar la justificación no crea otro registro de asistencia.

#### RF-016 — Registros anecdóticos

**Prioridad:** P1.  
**Actores:** ACT-02.  
**Dependencias:** RF-007, RF-008.

El sistema deberá permitir registrar, consultar y corregir observaciones anecdóticas vinculadas a estudiantes.

**Criterios de aceptación:**

- **CA1:** cada registro identifica estudiante, fecha, autor y descripción.
- **CA2:** la consulta de un estudiante muestra únicamente los registros correspondientes dentro del ámbito autorizado.
- **CA3:** una corrección mantiene la vinculación con el estudiante original y queda sujeta a auditoría.

#### RF-017 — Seguimiento de conducta

**Prioridad:** P1.  
**Actores:** ACT-02.  
**Dependencias:** RF-007, RF-008.

El sistema deberá permitir registrar y consultar información de conducta del estudiante.

**Criterios de aceptación:**

- **CA1:** un registro de conducta conserva estudiante, fecha, autor y descripción.
- **CA2:** los registros de conducta pueden identificarse de forma diferenciada de las observaciones anecdóticas.
- **CA3:** un registro anecdótico no genera automáticamente otro registro de conducta ni modifica una calificación académica.
- **CA4:** el seguimiento individual recupera únicamente los registros del estudiante seleccionado.

Estos dos tipos de registro podrán compartir componentes técnicos; no requieren duplicar información.

#### RF-018 — Informe grupal

**Prioridad:** P1.  
**Actores:** ACT-02.  
**Dependencias:** RF-003, RF-004, RF-005, RF-007. RF-006 cuando se indique materia y RF-008 cuando se relacionen estudiantes.

El sistema deberá permitir registrar y consultar acontecimientos asociados al grupo/curso cuando el hecho no corresponde a un estudiante específico o no puede individualizarse. Comprende, por ejemplo, ausencia colectiva, retiro colectivo, comportamiento grupal, evento institucional, incidente grupal o situación sin responsable individual identificado.

El informe contemplará fecha, institución, curso, materia opcional, docente, categoría, descripción, observaciones, estudiantes relacionados opcionalmente y evidencia opcional. Deberá poder imprimirse mediante RF-020. Es un registro propio del grupo y no un resumen generado a partir de registros individuales.

**Criterios de aceptación:**

- **CA1:** se puede guardar un informe indicando fecha, institución, curso, docente, categoría y descripción, sin materia, estudiantes relacionados ni evidencia.
- **CA2:** puede registrarse en un curso que no tenga evaluaciones, calificaciones, asistencias, registros anecdóticos ni registros de conducta previos.
- **CA3:** los datos guardados, incluidas las observaciones y los campos opcionales informados, se recuperan sin alteraciones.
- **CA4:** el docente solo registra y consulta informes de cursos autorizados por sus asignaciones; omitir la materia no amplía su acceso a otros cursos. Si se indica materia, debe corresponder a una asignación autorizada del docente en ese curso.
- **CA5:** al relacionar estudiantes, se valida su pertenencia al curso y el permiso de acceso. Dejarlos sin indicar es válido y no requiere identificar un responsable individual.
- **CA6:** la evidencia puede omitirse; si se aporta, queda asociada al informe y solo puede consultarse por usuarios autorizados para ese registro.
- **CA7:** el informe puede consultarse e imprimirse conservando los datos registrados, la identificación de la evidencia si existe y los estudiantes relacionados cuando se hayan indicado; la ausencia de campos opcionales no impide imprimirlo.
- **CA8:** registrar un acontecimiento grupal no crea automáticamente ausencias, registros de conducta ni modificaciones de calificaciones individuales.

### 4.4. Consulta, reportes e intercambio de información

#### RF-019 — Búsqueda y filtros

**Prioridad:** P1.  
**Actores:** ACT-01, ACT-02.  
**Dependencias:** RF-002, RF-007, RF-008, RF-009, RF-011, RF-013, RF-015, RF-016, RF-017, RF-018.

El sistema deberá permitir buscar y filtrar los listados incluidos en el alcance mediante los campos pertinentes de cada módulo.

**Criterios de aceptación:**

- **CA1:** al buscar un estudiante por nombre o cédula, se devuelven únicamente coincidencias autorizadas.
- **CA2:** los filtros de curso, materia y fechas, cuando correspondan, se aplican conjuntamente.
- **CA3:** quitar los filtros restablece el listado permitido, sin ampliar los permisos.
- **CA4:** una búsqueda sin coincidencias presenta un resultado vacío, sin mostrar registros de otro ámbito.

#### RF-020 — Reportes e impresión

**Prioridad:** P1.  
**Actores:** ACT-01, ACT-02, según permisos.  
**Dependencias:** RF-003, RF-005, RF-006, RF-008, RF-009, RF-013, RF-014, RF-015, RF-016, RF-017, RF-018, RF-028, RF-029. Cada reporte utiliza únicamente los módulos fuente que correspondan a su contenido.

El sistema deberá generar representaciones imprimibles de, como mínimo:

- Reporte académico individual.
- Reporte académico por curso.
- Reporte académico por materia.
- Reportes de tareas, evaluaciones y calificaciones.
- Asistencia diaria y por período.
- Conducta y registros anecdóticos.
- Informes grupales de acontecimientos definidos en RF-018.
- Planificación anual y planificación diaria.

**Criterios de aceptación:**

- **CA1:** la asistencia puede imprimirse para un día o un intervalo de fechas.
- **CA2:** el reporte de asistencia incluye únicamente fechas registradas dentro del intervalo seleccionado.
- **CA3:** los registros anecdóticos y de conducta pueden imprimirse por estudiante.
- **CA4:** las planillas de calificaciones conservan su contexto y valores; los informes grupales imprimen los acontecimientos registrados en RF-018 sin exigir registros individuales previos.
- **CA5:** la salida no corta nombres, columnas ni datos esenciales en el formato de papel definido en D-05.
- **CA6:** se genera un reporte académico individual y reportes académicos por curso y por materia; sus datos coinciden con las fuentes y con el ámbito seleccionado.
- **CA7:** los reportes de tareas, evaluaciones y calificaciones incluyen los registros seleccionados sin confundir resultados pendientes con cero, ni sumar dos veces una evaluación vinculada a una tarea.
- **CA8:** las planificaciones anual y diaria se imprimen con su contenido guardado y la identificación de institución, curso, materia y año o fecha, según corresponda.
- **CA9:** todos los reportes respetan los permisos, el ámbito y los filtros aplicables; la desactivación de una entidad no elimina sus datos históricos de los reportes autorizados.
- **CA10:** los reportes de asistencia distinguen los cuatro estados mínimos y la justificación complementaria, con su observación cuando exista.
- **CA11:** se verifica al menos una salida imprimible de cada tipo de reporte enumerado; los campos opcionales no informados y la ausencia de registros se presentan sin inventar información.

#### RF-021 — Consulta pública por cédula

**Prioridad:** P1.  
**Actores:** ACT-03.  
**Dependencias:** RF-008, RF-014.

El sistema deberá permitir la consulta pública por cédula dentro del límite de información expresamente aprobado.

**Criterios de aceptación:**

- **CA1:** una cédula con información habilitada devuelve exclusivamente los campos definidos en D-06.
- **CA2:** la respuesta de la API tampoco incluye campos privados ocultos por la interfaz.
- **CA3:** la consulta no permite modificar datos.
- **CA4:** una cédula inexistente o sin información habilitada no revela datos privados ni listados alternativos.
- **CA5:** se verifican las medidas contra consultas automatizadas definidas en RNF-004.

La cédula es un identificador de búsqueda; no constituye por sí sola una credencial de autenticación.

#### RF-022 — Importación de datos

**Prioridad:** P1.  
**Actores:** ACT-01, ACT-02, según permisos.  
**Dependencias:** RF-007, RF-008.

El sistema deberá importar los conjuntos de datos y formatos expresamente definidos para V1.0.

**Criterios de aceptación:**

- **CA1:** un archivo válido del contrato definido en D-05 incorpora los registros al ámbito seleccionado.
- **CA2:** los datos importados respetan las mismas validaciones que el registro manual.
- **CA3:** un archivo inválido informa los errores identificables sin indicar falsamente que la importación fue exitosa.
- **CA4:** el tratamiento de duplicados y la aceptación total o parcial coinciden con D-05.
- **CA5:** no se importan datos a cursos o instituciones fuera de los permisos del usuario.

La lectura de mallas curriculares se especifica separadamente en RF-027.

#### RF-023 — Exportación de datos

**Prioridad:** P1.  
**Actores:** ACT-01, ACT-02, según permisos.  
**Dependencias:** RF-019.

El sistema deberá exportar los conjuntos de datos autorizados en los formatos definidos para V1.0.

**Criterios de aceptación:**

- **CA1:** el archivo exportado abre correctamente en una herramienta compatible con el formato definido en D-05.
- **CA2:** sus registros coinciden con el ámbito y los filtros seleccionados.
- **CA3:** no incluye datos de instituciones o asignaciones ajenas.
- **CA4:** conserva identificadores, fechas y puntuaciones sin cambios de significado ni pérdida de precisión respecto del contrato de exportación.

#### RF-024 — Respaldo y restauración

**Prioridad:** P0.  
**Actores:** ACT-04.  
**Dependencias:** RF-003.

El sistema deberá contar con procedimientos autorizados para respaldar y restaurar los datos persistentes.

**Criterios de aceptación:**

- **CA1:** se genera un respaldo de una instalación de prueba con registros representativos.
- **CA2:** al restaurarlo en un entorno separado se recuperan los registros y sus relaciones.
- **CA3:** se comparan cantidades y valores de muestra antes del respaldo y después de la restauración.
- **CA4:** un usuario docente o un consultante público no puede descargar respaldos ni ejecutar restauraciones.

Este requisito no presupone una pantalla de respaldos ni una programación automática.

#### RF-025 — Auditoría de operaciones

**Prioridad:** P0.  
**Actores:** ACT-01, ACT-04, según autorización.  
**Dependencias:** RF-001, RF-002.

El sistema deberá mantener registros de auditoría de las operaciones relevantes para seguridad e integridad académica.

**Criterios de aceptación:**

- **CA1:** los cambios de roles, asignaciones, activación/desactivación de entidades, resultados académicos, asistencia, registros de seguimiento e informes grupales generan una entrada con fecha, actor, acción, entidad afectada y resultado.
- **CA2:** los intentos de autenticación generan registros sin guardar contraseñas ni cookies de sesión.
- **CA3:** las importaciones y restauraciones registran su ejecución y resultado cuando corresponda.
- **CA4:** un docente o consultante público no puede modificar ni eliminar las entradas de auditoría.
- **CA5:** el responsable autorizado puede recuperar las entradas necesarias para verificar una operación de prueba.

### 4.5. Currículo y planificación

#### RF-026 — Base curricular delimitada

**Prioridad:** P1.  
**Actores:** ACT-01, ACT-02, según permisos.  
**Dependencias:** RF-005, RF-006.

El sistema deberá almacenar y consultar la base curricular de Matemática Aplicada y Algorítmica para 1.º–3.º BTI.

**Criterios de aceptación:**

- **CA1:** se dispone de las seis combinaciones materia–año con las fuentes curriculares validadas.
- **CA2:** cada elemento curricular conserva su materia, año y referencia de origen.
- **CA3:** consultar una combinación no mezcla sus elementos con los de otra.
- **CA4:** los elementos almacenados coinciden con las fuentes aprobadas en D-07.

#### RF-027 — Lectura controlada de mallas

**Prioridad:** P1.  
**Actores:** ACT-01, ACT-02, según permisos.  
**Dependencias:** RF-026.

El sistema deberá permitir la lectura e incorporación controlada de las mallas contempladas en V1.0.

**Criterios de aceptación:**

- **CA1:** una malla de un formato y estructura admitidos en D-07 puede revisarse antes de incorporarse a la base curricular.
- **CA2:** los elementos reconocidos pueden comprobarse y corregirse antes de su confirmación.
- **CA3:** la lectura por sí sola no modifica la base curricular vigente.
- **CA4:** un documento no admitido informa la limitación sin inventar contenido curricular.
- **CA5:** la confirmación conserva la relación entre los elementos incorporados y su fuente.

#### RF-028 — Planificación anual

**Prioridad:** P1.  
**Actores:** ACT-02.  
**Dependencias:** RF-007, RF-026.

El sistema deberá permitir crear, consultar y modificar la planificación anual de una asignación utilizando la base curricular correspondiente.

**Criterios de aceptación:**

- **CA1:** la planificación identifica docente, curso, materia y año académico.
- **CA2:** los elementos curriculares vinculados pertenecen a la materia y al año correspondientes.
- **CA3:** la organización temporal guardada se recupera sin alteraciones.
- **CA4:** modificar una planificación no modifica otras asignaciones ni la base curricular de origen.

#### RF-029 — Planificación diaria

**Prioridad:** P1.  
**Actores:** ACT-02.  
**Dependencias:** RF-028.

El sistema deberá permitir crear, consultar y modificar planificaciones diarias vinculadas a la planificación anual correspondiente.

**Criterios de aceptación:**

- **CA1:** cada planificación diaria identifica fecha, asignación y planificación anual de referencia.
- **CA2:** sus elementos curriculares son coherentes con la planificación anual vinculada.
- **CA3:** el contenido guardado puede recuperarse y modificarse.
- **CA4:** modificar una planificación diaria no altera automáticamente la planificación anual ni otras planificaciones diarias.

#### RF-030 — Seguimiento curricular

**Prioridad:** P1.  
**Actores:** ACT-02.  
**Dependencias:** RF-028, RF-029.

El sistema deberá permitir registrar lo desarrollado y compararlo con lo planificado.

**Criterios de aceptación:**

- **CA1:** el docente puede registrar el desarrollo de un elemento curricular vinculado a su planificación.
- **CA2:** la consulta distingue lo planificado de lo efectivamente registrado como desarrollado.
- **CA3:** crear una planificación no marca automáticamente su contenido como desarrollado.
- **CA4:** cualquier cantidad o porcentaje mostrado puede reproducirse a partir de los registros y de la regla definida en D-07.

#### RF-031 — Asistente pedagógico con IA

**Prioridad:** P1.  
**Actores:** ACT-02, ACT-05.  
**Dependencias:** RF-026, RF-028, RF-029.

El sistema deberá permitir solicitar propuestas pedagógicas de apoyo a la planificación anual y diaria mediante OpenAI API.

**Criterios de aceptación:**

- **CA1:** una solicitud utiliza el contexto seleccionado de materia, año y elementos curriculares autorizados.
- **CA2:** la respuesta se presenta identificada como propuesta generada por IA.
- **CA3:** la generación no modifica automáticamente una planificación.
- **CA4:** los errores o la indisponibilidad del servicio se informan sin perder los datos guardados.
- **CA5:** no se atribuye a una fuente curricular contenido que no figure en ella.

Este requisito no habilita funciones adicionales de IA fuera del apoyo pedagógico comprometido.

#### RF-032 — Revisión y aprobación de propuestas de IA

**Prioridad:** P1.  
**Actores:** ACT-02.  
**Dependencias:** RF-031.

El sistema deberá permitir revisar, modificar, descartar y aprobar una propuesta antes de incorporarla a una planificación.

**Criterios de aceptación:**

- **CA1:** el docente puede editar la propuesta antes de aprobarla.
- **CA2:** descartarla deja intacta la planificación existente.
- **CA3:** únicamente una acción explícita de aprobación incorpora el contenido revisado.
- **CA4:** la aprobación no marca el contenido como desarrollado.
- **CA5:** la incorporación identifica al docente responsable y queda registrada en auditoría.

### 4.6. Dashboard y perfil del estudiante

#### RF-033 — Dashboard

**Prioridad:** P2.  
**Actores:** ACT-01, ACT-02.  
**Dependencias:** RF-002, RF-003, RF-005, RF-006, RF-007, RF-008, RF-009, RF-013, RF-015.

El sistema deberá mostrar un dashboard con información relevante según el rol y el ámbito autorizado del usuario: institución, cursos, materias, estudiantes, tareas, evaluaciones, asistencia, pendientes y accesos rápidos a las funciones disponibles. No requiere analítica avanzada.

**Criterios de aceptación:**

- **CA1:** Administración visualiza información de su ámbito institucional autorizado y el docente únicamente de sus asignaciones.
- **CA2:** el dashboard presenta información o un estado vacío explícito para institución, cursos, materias, estudiantes, tareas, evaluaciones, asistencia y pendientes, según los permisos del usuario.
- **CA3:** los listados o cantidades mostrados coinciden con sus módulos de origen y no incluyen registros de ámbitos ajenos.
- **CA4:** los pendientes se derivan de los estados ya existentes, como resultados sin evaluar; no se crea un módulo nuevo de pendientes ni se inventan obligaciones.
- **CA5:** cada acceso rápido abre la función correspondiente dentro del ámbito permitido; no elude controles de autorización.
- **CA6:** al recargar el dashboard después de una modificación, la información coincide con los datos persistidos; se distinguen entidades inactivas cuando se presenten y no se ofrecen como disponibles para nuevas operaciones.

#### RF-034 — Perfil académico integral del estudiante

**Prioridad:** P1.  
**Actores:** ACT-01, ACT-02, según permisos.  
**Dependencias:** RF-002, RF-008, RF-009, RF-013, RF-014, RF-015, RF-016, RF-017.

El sistema deberá centralizar en una vista del estudiante sus datos básicos, tareas, evaluaciones, calificaciones, asistencia, registros anecdóticos y conducta, dentro del ámbito autorizado del usuario.

**Criterios de aceptación:**

- **CA1:** seleccionar un estudiante muestra sus datos básicos y las secciones de tareas, evaluaciones, calificaciones, asistencia, registros anecdóticos y conducta.
- **CA2:** cada sección coincide con sus registros fuente; una sección sin datos muestra esa condición sin inventar resultados ni asignar cero a pendientes.
- **CA3:** el docente no puede consultar información del estudiante perteneciente a cursos o materias fuera de sus asignaciones, aunque comparta al mismo estudiante con otros docentes.
- **CA4:** la vista diferencia el curso, materia y contexto académico de los registros cuando corresponda; los vínculos entre tareas y evaluaciones no duplican resultados.
- **CA5:** el perfil de un estudiante inactivo conserva su información histórica para usuarios autorizados y muestra su condición de inactivo.
- **CA6:** el perfil utiliza los registros existentes sin crear copias académicas independientes; al volver a consultarlo refleja las modificaciones guardadas en los módulos fuente.
- **CA7:** el perfil es privado y no amplía los campos de la consulta pública de RF-021.

## 5. Requisitos no funcionales

### RNF-001 — Arquitectura y tecnologías aprobadas

**Prioridad:** P0.  
**Ámbito:** todos los RF.

La aplicación deberá utilizar una arquitectura modular cliente-servidor con las tecnologías aprobadas.

**Criterios de aceptación:**

- **CA1:** el frontend utiliza React, Vite, TypeScript y Tailwind CSS.
- **CA2:** el backend utiliza Node.js, Express y TypeScript, y expone una API REST.
- **CA3:** PostgreSQL almacena los datos persistentes y Prisma ORM gestiona el acceso ordinario a ellos.
- **CA4:** Zod valida los datos de entrada en el backend.
- **CA5:** el frontend no accede directamente a PostgreSQL ni contiene credenciales de base de datos.
- **CA6:** los módulos separan responsabilidades de acceso, gestión académica, currículo, planificación e IA.

### RNF-002 — Protección de credenciales y sesiones

**Prioridad:** P0.  
**Ámbito:** RF-001, RF-004.

**Criterios de aceptación:**

- **CA1:** las contraseñas se almacenan mediante un algoritmo de hashing específico para contraseñas, con sal y parámetros documentados; nunca en texto plano ni mediante cifrado reversible.
- **CA2:** la sesión utiliza cookies con `HttpOnly`; en producción también utiliza `Secure` sobre HTTPS.
- **CA3:** las credenciales de sesión no se almacenan en `localStorage` ni `sessionStorage`.
- **CA4:** la duración y expiración de sesión quedan documentadas y se verifica el rechazo de una sesión vencida.
- **CA5:** las respuestas de usuario y los registros técnicos no exponen hashes ni secretos de sesión.

### RNF-003 — Autorización efectiva y aislamiento

**Prioridad:** P0.  
**Ámbito:** RF-002 y todos los recursos privados.

**Criterios de aceptación:**

- **CA1:** las autorizaciones se verifican en el backend para lectura, escritura, importación, exportación y reportes.
- **CA2:** una batería de pruebas intenta acceder con identificadores de otra institución, curso y materia; todas las operaciones no autorizadas se rechazan sin exponer datos.
- **CA3:** ocultar una opción en la interfaz no constituye el único control de acceso.
- **CA4:** las consultas públicas siguen un contrato separado de los recursos privados.

### RNF-004 — Seguridad de solicitudes y exposición

**Prioridad:** P0.  
**Ámbito:** RF-001, RF-021, RF-022, RF-027, RF-031 y operaciones de escritura.

**Criterios de aceptación:**

- **CA1:** las solicitudes de modificación con cookies están protegidas frente a CSRF mediante una estrategia documentada y probada.
- **CA2:** CORS permite únicamente los orígenes configurados para el entorno.
- **CA3:** las entradas de prueba con scripts no ejecutan contenido al mostrarse en la aplicación.
- **CA4:** las consultas a la base de datos evitan concatenar entradas del usuario como instrucciones SQL.
- **CA5:** autenticación, consulta pública y solicitudes de IA aplican límites documentados; al superarlos rechazan nuevas solicitudes de forma controlada.
- **CA6:** las importaciones y la evidencia opcional de informes grupales rechazan archivos que exceden los límites o formatos admitidos; el acceso a la evidencia exige autorización sobre su informe.
- **CA7:** los errores externos no muestran trazas internas ni secretos.

### RNF-005 — Validación e integridad de datos

**Prioridad:** P0.  
**Ámbito:** todos los RF que escriben datos.

**Criterios de aceptación:**

- **CA1:** entradas inválidas enviadas directamente a la API son rechazadas mediante validación del backend.
- **CA2:** las relaciones obligatorias no admiten referencias a entidades inexistentes.
- **CA3:** se verifican restricciones contra duplicidades de cuentas, asignaciones y resultados según sus reglas.
- **CA4:** una operación atómica que falla no deja registros parcialmente aplicados.
- **CA5:** no se permite eliminar o modificar información de forma que deje registros académicos sin sus referencias necesarias.
- **CA6:** la desactivación de instituciones, docentes, cursos, materias y estudiantes conserva sus relaciones históricas; las restricciones de integridad impiden su eliminación física cuando existen esas relaciones.

### RNF-006 — Uso de IA exclusivamente desde backend

**Prioridad:** P0.  
**Ámbito:** RF-031, RF-032.

**Criterios de aceptación:**

- **CA1:** las solicitudes a OpenAI API se originan únicamente en el backend.
- **CA2:** ninguna clave de OpenAI aparece en el paquete del frontend, sus respuestas o el repositorio.
- **CA3:** antes de solicitar la generación se verifica sesión y asignación.
- **CA4:** una inspección de las solicitudes confirma que no se envían cédulas, nombres de estudiantes ni registros anecdóticos o de conducta para generar planificaciones.
- **CA5:** la indisponibilidad de OpenAI no impide utilizar las funciones manuales de gestión y planificación.

### RNF-007 — Persistencia y recuperación

**Prioridad:** P0.  
**Ámbito:** RF-003 a RF-030 y datos aprobados de RF-032.

**Criterios de aceptación:**

- **CA1:** los registros confirmados permanecen después de recargar la interfaz y reiniciar los servicios conservando el almacenamiento.
- **CA2:** dos sesiones autorizadas consultan la misma información persistida.
- **CA3:** el procedimiento de recuperación de RF-024 puede ejecutarse siguiendo el Manual Técnico.
- **CA4:** el resultado del ensayo de restauración queda documentado.

### RNF-008 — Interfaz responsive

**Prioridad:** P1.  
**Ámbito:** interfaces de los RF.

**Criterios de aceptación:**

- **CA1:** los flujos principales pueden completarse en anchos de referencia de 360, 768 y 1366 píxeles.
- **CA2:** formularios, botones y mensajes no quedan superpuestos ni inaccesibles.
- **CA3:** las tablas extensas disponen de desplazamiento dentro de su contenedor u otra presentación que permita consultar todos sus datos.
- **CA4:** las acciones principales son utilizables mediante teclado y muestran etiquetas y errores identificables.

### RNF-009 — Entorno local reproducible

**Prioridad:** P0.  
**Ámbito:** instalación completa.

**Criterios de aceptación:**

- **CA1:** Docker Compose permite iniciar frontend, backend y PostgreSQL siguiendo el Manual Técnico.
- **CA2:** se incluyen ejemplos de configuración sin secretos reales.
- **CA3:** las migraciones de Prisma permiten crear la estructura de la base de datos desde una instalación vacía.
- **CA4:** una segunda instalación limpia reproduce el entorno siguiendo exclusivamente las instrucciones documentadas.

### RNF-010 — Pruebas unitarias, de integración y de interfaz

**Prioridad:** P0.  
**Ámbito:** reglas y componentes de los RF.

**Criterios de aceptación:**

- **CA1:** Vitest ejecuta pruebas de reglas académicas, incluidos puntos fuera de escala, pendientes y conversión de calificaciones.
- **CA2:** Supertest verifica autenticación, autorización y validación de la API.
- **CA3:** React Testing Library verifica formularios y estados relevantes de la interfaz.
- **CA4:** existen pruebas negativas de acceso entre asignaciones e instituciones.
- **CA5:** los comandos y resultados de ejecución están documentados y las pruebas requeridas finalizan correctamente antes de la aceptación.
- **CA6:** se prueban los cuatro estados de asistencia y la justificación separada, la creación de evaluaciones sin tarea y de informes grupales sin registros individuales, la conservación histórica tras desactivar entidades y el aislamiento de datos en dashboard y perfil académico.

### RNF-011 — Pruebas de extremo a extremo

**Prioridad:** P1.  
**Ámbito:** recorridos completos de usuario.

**Criterios de aceptación:**

- **CA1:** Playwright verifica inicio y cierre de sesión.
- **CA2:** verifica creación de tarea, evaluación y actualización de la planilla, incluidos puntos fuera de escala.
- **CA3:** verifica registro de asistencia y consulta del reporte por fechas.
- **CA4:** verifica planificación, revisión y aprobación de una propuesta de IA.
- **CA5:** verifica el contrato de consulta pública y el rechazo de accesos privados no autorizados.
- **CA6:** las pruebas automatizadas pueden ejecutarse con datos ficticios y respuestas controladas de OpenAI, sin depender de llamadas pagadas.
- **CA7:** Playwright verifica el registro, consulta e impresión de un informe grupal sin estudiantes relacionados ni registros individuales previos.
- **CA8:** verifica la creación de una evaluación sin tarea previa, la consulta del dashboard y del perfil académico, y la desactivación/reactivación conservando el historial y aplicando las restricciones de acceso correspondientes.

### RNF-012 — Trazabilidad de aceptación

**Prioridad:** P1.  
**Ámbito:** todos los RF y RNF.

**Criterios de aceptación:**

- **CA1:** cada criterio de aceptación se vincula con una prueba automatizada, comprobación manual, inspección técnica o revisión documental.
- **CA2:** la matriz de verificación registra identificador, método, resultado y evidencia.
- **CA3:** ningún requisito se declara aceptado si tiene criterios incumplidos o decisiones pendientes que impidan verificarlo.
- **CA4:** los defectos detectados se relacionan con el requisito afectado.

### RNF-013 — Manual de Usuario

**Prioridad:** P2.  
**Ámbito:** funciones de ACT-01, ACT-02 y ACT-03.

**Criterios de aceptación:**

- **CA1:** describe acceso, activación/desactivación, dashboard, perfil académico integral, gestión académica, asistencia y justificación, seguimiento, informes grupales, todos los reportes de RF-020, currículo, planificación y revisión de IA.
- **CA2:** diferencia las operaciones disponibles para cada actor.
- **CA3:** explica puntos fuera de escala, resultados pendientes y límites de consulta pública.
- **CA4:** un revisor puede ejecutar los recorridos documentados sin instrucciones adicionales.
- **CA5:** capturas, términos y procedimientos corresponden a la versión entregada.

### RNF-014 — Manual Técnico

**Prioridad:** P2.  
**Ámbito:** instalación, arquitectura, seguridad y operación.

**Criterios de aceptación:**

- **CA1:** documenta módulos, modelo de datos, API, variables de entorno y decisiones de seguridad.
- **CA2:** contiene procedimientos de instalación, migraciones, pruebas, respaldo y restauración.
- **CA3:** explica la integración con OpenAI sin incluir secretos reales.
- **CA4:** permite reproducir RNF-009 y el ensayo de RF-024.

### RNF-015 — Documentación completa de la tesis

**Prioridad:** P2.  
**Ámbito:** proyecto V1.0.

**Criterios de aceptación:**

- **CA1:** contiene problema, objetivos, justificación, alcance, fundamentos, metodología, análisis, diseño, implementación, pruebas, resultados, conclusiones y referencias.
- **CA2:** mantiene trazabilidad entre objetivos, requisitos, solución implementada y evidencias.
- **CA3:** distingue funcionalidades implementadas, limitaciones y propuestas futuras.
- **CA4:** no presenta funcionalidades futuras o incompletas como resultados entregados.
- **CA5:** satisface la estructura académica exigida por la institución, una vez disponible.

## 6. Dependencias y orden de implementación

Las dependencias individuales de la sección 4 son la referencia normativa. La siguiente tabla resume su organización.

| Bloque | Requisitos | Fundamentos principales |
|---|---|---|
| Acceso | RF-001–RF-002 | Sesión y autorización. |
| Estructura institucional | RF-003–RF-008 | Acceso, instituciones, docentes, cursos y materias. |
| Gestión académica | RF-009–RF-014 | Asignaciones y estudiantes. |
| Seguimiento del estudiante | RF-015–RF-017 | Asignaciones y estudiantes. |
| Acontecimientos grupales | RF-018 | Institución, docente y curso autorizado; sin registros individuales previos. |
| Consulta e intercambio | RF-019–RF-023 | Datos académicos y permisos. |
| Operación y trazabilidad | RF-024–RF-025 | Persistencia, acceso y autorización. |
| Currículo | RF-026–RF-027 | Cursos y materias. |
| Planificación | RF-028–RF-030 | Asignaciones y base curricular. |
| Asistencia con IA | RF-031–RF-032 | Currículo y planificación manual. |
| Dashboard | RF-033 | Datos existentes y permisos del usuario. |
| Perfil académico integral | RF-034 | Estudiante y módulos académicos y de seguimiento autorizados. |

Relaciones transversales:

- RNF-001 y RNF-005 condicionan la implementación de todos los módulos.
- RNF-002, RNF-003 y RNF-004 condicionan cualquier exposición de datos.
- RF-025 registra las operaciones especificadas sin requerir que cada módulo implemente una auditoría independiente.
- RNF-006 condiciona RF-031 y RF-032.
- RNF-010, RNF-011 y RNF-012 verifican los requisitos correspondientes.
- RNF-013, RNF-014 y RNF-015 documentan la versión efectivamente entregada.

Estas relaciones transversales son condiciones de cumplimiento, no dependencias funcionales circulares.

Las dependencias opcionales de RF-013 y RF-018 se aplican solo cuando se utiliza el vínculo indicado. RF-013 no requiere una tarea previa. RF-018 no depende de RF-014, RF-015, RF-016 ni RF-017; la impresión depende de RF-020 como servicio de presentación, sin invertir la dependencia funcional RF-020 → RF-018. RF-033 y RF-034 consultan módulos existentes y no exigen crear registros nuevos en ellos para mostrar un estado vacío.

## 7. Decisiones de detalle: pendientes y resueltas

No se asignan silenciosamente reglas que no están documentadas en el alcance disponible. D-04 queda resuelta; las demás decisiones conservan su estado pendiente, con D-05 ajustada a la definición corregida de informe grupal.

| ID | Decisión necesaria | Requisitos afectados | Condición de cierre |
|---|---|---|---|
| D-01 | Alcance institucional de Administración; permisos exactos de alta y modificación; procedimiento de establecimiento de credenciales; visibilidad del banco de actividades. | RF-002–RF-004, RF-008, RF-011 | Matriz de permisos y procedimiento de cuentas definidos. |
| D-02 | Identificación del curso por año lectivo, año de estudio, sección y turno según corresponda; identificación de estudiantes; ámbito exacto de la asistencia. | RF-005, RF-007, RF-008, RF-015, RF-028 | Diccionario de datos y reglas de unicidad definidos. |
| D-03 | Conversión de puntos a notas, redondeo, tratamiento de pendientes, límite de puntos adicionales y modificación de puntuaciones con resultados existentes. | RF-009, RF-010, RF-014 | Tabla de reglas con ejemplos numéricos de entrada y resultado esperado. |
| D-04 — Resuelta | Estados mínimos: `PRESENTE`, `AUSENTE`, `LLEGADA_TARDIA` y `SALIDA_ANTICIPADA`. La justificación es un atributo complementario y puede incluir observación; no sustituye el estado. | RF-015, RF-020, RF-033, RF-034 | Definición cerrada por el usuario. Verificación mediante RF-015-CA4 a CA7 y RF-020-CA10. |
| D-05 | Entidades y formatos de importación/exportación; duplicados y atomicidad; formatos de impresión de todos los reportes de RF-020. Para el informe grupal, precisar el catálogo de categorías y formatos/límites de evidencia. Su significado y campos ya están definidos en RF-018: acontecimiento propio del curso, con materia, estudiantes relacionados y evidencia opcionales, sin registros individuales previos. | RF-018, RF-020, RF-022, RF-023 | Contratos de archivo, categorías, límites de evidencia y ejemplos de cada reporte definidos, incluida la impresión de un acontecimiento grupal sin datos individuales. |
| D-06 | Campos y períodos visibles en consulta pública por cédula y condiciones de habilitación. | RF-021 | Contrato de respuesta pública aprobado y probado, incluida la ausencia de campos privados. |
| D-07 | Fuentes y formatos de las seis mallas, estructura de planificación y regla para representar avance curricular. | RF-026–RF-030 | Fuentes verificadas, estructura de datos y ejemplos de seguimiento definidos. |

Los requisitos afectados pueden diseñarse parcialmente, pero **no pueden darse por aceptados mientras su decisión pendiente impida verificar los criterios**. El cierre de D-04 fija la regla y no equivale a haber implementado ni probado RF-015.

Significado de los estados de D-04:

| Estado | Significado |
|---|---|
| `PRESENTE` | Presencia registrada sin señalar llegada tardía ni salida anticipada en ese registro. |
| `AUSENTE` | Ausencia registrada. |
| `LLEGADA_TARDIA` | Asistencia con llegada posterior al inicio correspondiente. |
| `SALIDA_ANTICIPADA` | Asistencia con salida anterior a la finalización correspondiente. |

La justificación conserva el estado original. La unidad de registro sigue pendiente de D-02; D-04 no establece una precedencia para hechos múltiples dentro de una unidad aún no definida.

## 8. Revisión de consistencia global

### 8.1. Cobertura del alcance

| Elemento solicitado | Requisitos |
|---|---|
| Autenticación y roles | RF-001–RF-002; RNF-002–RNF-004 |
| Instituciones, docentes, cursos y materias | RF-003–RF-006 |
| Activación/desactivación y conservación histórica | RF-003–RF-008 según entidad; sección 2.3; RNF-005 |
| Asignación Docente–Curso–Materia | RF-007; RNF-003 |
| Estudiantes | RF-008 |
| Tareas y puntos fuera de escala | RF-009–RF-010 |
| Banco y reutilización | RF-011–RF-012 |
| Evaluaciones independientes de tareas y calificaciones | RF-013–RF-014 |
| Asistencia y justificación complementaria | RF-015, RF-020; D-04 resuelta |
| Registros anecdóticos y conducta | RF-016–RF-017, RF-020 |
| Informes de acontecimientos grupales sin registros individuales previos | RF-018, RF-020 |
| Búsqueda y filtros | RF-019 |
| Reportes académicos individuales, por curso y materia; tareas, evaluaciones y calificaciones | RF-020 |
| Impresión de asistencia, conducta, registros anecdóticos e informes grupales | RF-020 |
| Impresión de planificación anual y diaria | RF-020, RF-028–RF-029 |
| Consulta pública | RF-021 |
| Importación y exportación | RF-022–RF-023 |
| Respaldos y auditoría | RF-024–RF-025 |
| Base curricular y lectura controlada | RF-026–RF-027 |
| Matemática Aplicada y Algorítmica, 1.º–3.º BTI | RF-026 |
| Planificación anual y diaria | RF-028–RF-029 |
| Seguimiento curricular | RF-030 |
| Asistente pedagógico con IA | RF-031–RF-032; RNF-006 |
| Dashboard según usuario | RF-033 |
| Perfil académico integral del estudiante | RF-034 |
| Arquitectura y entorno local | RNF-001, RNF-009 |
| Seguridad, integridad y persistencia | RNF-002–RNF-007 |
| Responsive | RNF-008 |
| Pruebas y aceptación | RNF-010–RNF-012 |
| Documentación | RNF-013–RNF-015 |

### 8.2. Comprobaciones realizadas

| Comprobación | Resultado |
|---|---|
| Identificadores | 34 RF y 15 RNF: 49 requisitos, con numeración única y consecutiva. |
| Criterios de aceptación | Todos los requisitos tienen al menos un criterio verificable. |
| Actores | Cada RF identifica actores; cada RNF identifica su ámbito de aplicación. |
| Prioridades | Todos los requisitos tienen P0, P1 o P2. |
| Referencias | Las dependencias citan requisitos existentes. |
| Circularidad | No se identifican ciclos en las dependencias funcionales declaradas. |
| Requisitos huérfanos | Todos están vinculados al alcance solicitado y a un actor o condición transversal. |
| Duplicidades | Banco, reutilización, evaluación y calificación tienen responsabilidades diferenciadas. |
| Reportes y exportaciones | RF-020 contempla todos los reportes mínimos solicitados; la impresión y el intercambio estructurado de datos se especifican por separado. |
| Informe grupal | Registra hechos propios del curso, con vínculos opcionales; no agrega ni exige registros individuales. |
| Evaluaciones | Pueden crearse directamente en una asignación, sin tarea previa; los vínculos a actividades e instrumentos son opcionales. |
| Ciclo de vida | Las cinco entidades admiten activación/desactivación; se conserva el historial y se impide la eliminación física con relaciones históricas. |
| Asistencia | D-04 está resuelta con cuatro estados mínimos; la justificación es complementaria y no cambia el estado. |
| Dashboard y perfil | Consultan datos fuente autorizados, no duplican registros ni amplían la consulta pública. |
| Registros anecdóticos y conducta | Se distinguen semánticamente sin exigir almacenamiento duplicado. |
| Planificación y seguimiento | Planificar no implica registrar desarrollo efectivo. |
| IA | Generar una propuesta no implica aprobarla ni incorporarla automáticamente. |
| Consulta pública y privacidad | La excepción pública queda limitada a un contrato específico, pendiente de D-06. |
| Alcance de la revisión | Solo se incorporan RF-033 y RF-034 y las correcciones expresamente solicitadas, con sus ajustes derivados de seguridad, pruebas y documentación. |
| Conservación de RNF | Se conservan los 15 RNF; solo RNF-004, RNF-005, RNF-010, RNF-011 y RNF-013 reciben ajustes derivados. |
| Decisiones | Se conservan D-01 a D-07; D-04 resuelta, D-05 actualizada y las demás sin alterar su contenido. |

### 8.3. Estado de la especificación

La revisión no identifica requisitos duplicados, referencias inexistentes ni contradicciones internas en la formulación presentada.

La especificación cubre el alcance declarado, pero **todavía requiere cerrar D-01, D-02, D-03, D-05, D-06 y D-07 para constituir una línea base completamente verificable**. D-04 queda resuelta. Las decisiones pendientes precisan el comportamiento de V1.0; no amplían su alcance.

No se ha desarrollado código.
