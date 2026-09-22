# EduGestor — Especificación de requisitos V1.0

**Proyecto:** aplicación de gestión docente para tesis.  
**Versión:** 1.0.  
**Revisión documental:** 4 — precisiones de D-05 a D-07; D-01 a D-04 conservadas.  
**Estado:** decisiones D-01 a D-07 RESUELTAS; especificación lista para diseño e implementación dentro del alcance congelado.  
**Fecha:** 22 de septiembre de 2026.  
**Archivo de destino:** `REQUIREMENTS.md`.

## 1. Propósito y alcance

Este documento formaliza los requisitos funcionales y no funcionales de EduGestor V1.0, sus actores, prioridades, dependencias y criterios de aceptación.

La V1.0 utilizará una arquitectura modular cliente-servidor. El prototipo anterior constituye una referencia funcional; su implementación y sus limitaciones técnicas no determinan la nueva arquitectura.

El alcance funcional está congelado. Las decisiones resueltas de este documento precisan reglas de funcionalidades ya incluidas y no autorizan funcionalidades adicionales.

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
- Las decisiones `D-01` a `D-07` están **RESUELTAS** y son normativas para los requisitos afectados. Su cierre no equivale a la implementación ni a la aceptación de la aplicación.
- Las restricciones referidas al actor Docente describen su acceso docente. Si la misma persona posee roles administrativos, cualquier operación adicional exige sus permisos explícitos y su ámbito administrativo; no se concede por ser docente.
- Los permisos se evalúan asociados a su ámbito: un permiso concedido en un curso no se extiende a otros cursos por acumular varios roles.

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
| ACT-01 | Administración | Gestiona la estructura institucional, docentes y asignaciones, y realiza las operaciones administrativas autorizadas. Opera con uno o más roles, permisos explícitos y ámbito de institución, cursos/secciones o recursos. Solo puede delegar lo permitido en D-01, sin privilegios globales automáticos. |
| ACT-02 | Docente | Gestiona el trabajo académico y pedagógico correspondiente a sus asignaciones Docente–Curso–Materia. |
| ACT-03 | Consultante público | Consulta por cédula únicamente la información expresamente habilitada para exposición pública. No modifica datos. |
| ACT-04 | Responsable técnico | Instala, configura, mantiene, respalda y restaura el sistema mediante procedimientos autorizados. Puede utilizar una cuenta raíz/técnica exclusivamente para bootstrap y administración excepcional, con auditoría; no para trabajo cotidiano. |
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

#### RF-002 — Control de acceso por roles, permisos, ámbito y asignación

**Prioridad:** P0.  
**Actores:** ACT-01, ACT-02.  
**Dependencias:** RF-001.

El sistema deberá autorizar las operaciones mediante roles, permisos explícitos y ámbito (scope), aplicando mínimo privilegio. Para el acceso docente se comprobarán además las asignaciones Docente–Curso–Materia. La administración será jerárquica y delegable dentro del límite de permisos y ámbito del administrador que delega.

**Criterios de aceptación:**

- **CA1:** un docente puede operar sobre una combinación Docente–Curso–Materia autorizada.
- **CA2:** al modificar identificadores en una solicitud directa a la API, el docente no puede leer ni modificar información de una asignación ajena.
- **CA3:** una operación administrativa solicitada con acceso exclusivamente docente se rechaza; si el usuario tiene además un rol administrativo, se verifican sus permisos y ámbito para esa operación.
- **CA4:** al retirarse una asignación, las solicitudes posteriores del docente a ese ámbito dejan de autorizarse.
- **CA5:** cada administrador tiene uno o más roles, permisos explícitos y ámbito; el rol de administrador por sí solo no autoriza acceso global ni operaciones fuera de ese ámbito.
- **CA6:** un administrador con permiso explícito para crear administradores puede crear otro con ámbito igual o contenido en el propio y permisos que sean un subconjunto de los que posee dentro de ese ámbito.
- **CA7:** se rechaza tanto la creación como la modificación de un administrador si concede un permiso que el actor no posee, amplía su ámbito o intenta elevar sus propios privilegios, incluso mediante solicitudes directas a la API.
- **CA8:** se verifican ámbitos de institución completa, uno o varios cursos/secciones y recursos específicos; un permiso en un ámbito no puede combinarse con otro ámbito para obtener acceso no concedido.
- **CA9:** la creación de administradores y los cambios de roles, permisos y ámbito quedan auditados; la cuenta raíz/técnica se reserva al bootstrap y a actuaciones excepcionales documentadas, sin asignarla a los recorridos cotidianos de Administración o Docente.

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
- **CA4:** el alta de un docente permite establecer sus credenciales mediante un procedimiento de alta autorizado y documentado conforme a RNF-002 y RNF-014, sin exponer contraseñas almacenadas.
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

- **CA1:** cada curso identifica Institución + Año Lectivo + Año/Grado + Sección + Turno; no se admite otro curso con la misma combinación.
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

- **CA1:** una asignación vincula un docente, un curso y una materia existentes, respetando la institución y el contexto Institución + Año Lectivo + Año/Grado + Sección + Turno del curso.
- **CA2:** no se permite duplicar la misma asignación dentro del mismo contexto académico.
- **CA3:** el docente visualiza las asignaciones autorizadas al acceder a su área de trabajo.
- **CA4:** modificar o retirar una asignación no elimina los registros históricos asociados.
- **CA5:** no se crea una asignación nueva si el docente, la institución, el curso o la materia están inactivos; las asignaciones históricas se conservan.

#### RF-008 — Gestión de estudiantes y vinculación a cursos

**Prioridad:** P0.  
**Actores:** ACT-01, ACT-02, según permisos.  
**Dependencias:** RF-005, RF-007.

El sistema deberá permitir registrar, consultar, actualizar, activar y desactivar estudiantes, y mantener sus matrículas en los cursos correspondientes. El estudiante será independiente de sus matrículas y tendrá UUID interno como clave primaria; la cédula, cuando esté disponible, será única y no será la clave primaria.

**Criterios de aceptación:**

- **CA1:** una matrícula vincula Estudiante + Curso + Año Lectivo y hace aparecer al estudiante en los listados autorizados correspondientes; el año lectivo debe coincidir con el del curso.
- **CA2:** actualizar sus datos personales conserva las evaluaciones, asistencias y registros asociados.
- **CA3:** se rechaza una cédula ya asociada a otro estudiante; se admiten estudiantes sin cédula, identificados por UUID, sin usar valores ficticios para completar ese campo.
- **CA4:** el docente no puede gestionar estudiantes de cursos fuera de sus asignaciones.
- **CA5:** un usuario autorizado puede desactivar y reactivar la entidad de tipo estudiante; cada cambio se conserva después de recargar la aplicación.
- **CA6:** la desactivación conserva los identificadores, vínculos e historial, permite su consulta e impresión autorizadas y bloquea los usos nuevos definidos en la sección 2.3.
- **CA7:** intentar eliminar físicamente la entidad con relaciones históricas es rechazado, sin borrar la entidad ni sus registros.
- **CA8:** la reactivación recupera la disponibilidad de la misma entidad conforme a los demás estados y permisos vigentes, sin duplicar registros ni reactivar entidades relacionadas.
- **CA9:** no se admite duplicar la matrícula Estudiante + Curso + Año Lectivo; el mismo estudiante puede conservar matrículas de distintos contextos sin duplicar su identidad.
- **CA10:** incorporar o corregir una cédula conserva el UUID y las relaciones históricas; acceder a una matrícula no autoriza consultar otras matrículas ajenas al ámbito del usuario.

### 4.2. Actividades, evaluaciones y calificaciones

#### RF-009 — Gestión de tareas

**Prioridad:** P0.  
**Actores:** ACT-02.  
**Dependencias:** RF-007.

El sistema deberá permitir crear, consultar y modificar tareas vinculadas a una asignación académica, con su descripción y puntuación correspondiente.

**Criterios de aceptación:**

- **CA1:** una tarea guardada se recupera con su descripción, puntuación y asignación.
- **CA2:** no se puede crear una tarea en una asignación ajena.
- **CA3:** al modificar el puntaje máximo de una actividad con resultados, el sistema advierte al docente, muestra el cambio y requiere confirmación explícita; cancelar conserva el máximo y los resultados derivados anteriores.
- **CA4:** confirmar un cambio válido de puntaje máximo recalcula los valores derivados afectados y registra en auditoría el valor anterior, el nuevo valor, el docente y la operación; no sustituye silenciosamente los puntajes obtenidos ni convierte pendientes en cero.

#### RF-010 — Puntos fuera de escala

**Prioridad:** P0.  
**Actores:** ACT-02.  
**Dependencias:** RF-009.

El sistema deberá permitir identificar tareas cuyos puntos se suman como adicionales sin incrementar la escala base.

**Criterios de aceptación:**

- **CA1:** una tarea fuera de escala se distingue visualmente de una tarea ordinaria.
- **CA2:** con una escala base de 20 puntos, 15 puntos ordinarios obtenidos y 3 puntos adicionales obtenidos, el sistema conserva la escala base en 20 y muestra 18 puntos acumulados.
- **CA3:** los listados distinguen puntos ordinarios y adicionales.
- **CA4:** con 20 puntos ordinarios posibles, 20 obtenidos y 3 adicionales obtenidos, el acumulado es 23 y el porcentaje interno es 115 %; el denominador sigue siendo 20 y la calificación formal no supera la máxima configurada.

#### RF-011 — Banco de actividades

**Prioridad:** P1.  
**Actores:** ACT-02.  
**Dependencias:** RF-007.

El sistema deberá permitir guardar y consultar actividades reutilizables, incluidas tareas e instrumentos de evaluación.

**Criterios de aceptación:**

- **CA1:** una actividad guardada en el banco puede recuperarse posteriormente con su contenido.
- **CA2:** las entradas del banco no contienen calificaciones, asistencias ni datos personales de estudiantes.
- **CA3:** el banco es privado por docente: otro docente o una cuenta administrativa cotidiana no puede listar, leer ni reutilizar sus entradas por tener acceso al mismo curso o institución.

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
- **CA5:** la reutilización desde el banco solo permite elementos propios del docente; la copia de una actividad aplicada no concede acceso al banco privado de su autor.

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
- **CA5:** no se admite evaluar a un estudiante sin matrícula correspondiente al curso y año lectivo de la asignación.
- **CA6:** si se vincula una tarea, actividad o instrumento, el sistema comprueba su existencia, compatibilidad con el contexto y permisos de acceso.
- **CA7:** una evaluación sin vínculo opcional admite resultados, estado pendiente/evaluado y cálculo de calificaciones igual que una evaluación vinculada.
- **CA8:** si se modifica el puntaje máximo de una evaluación con resultados, se advierte, se requiere confirmación, se recalculan los valores derivados afectados y se audita la operación conforme a D-03, aunque la evaluación no esté vinculada a una tarea.

#### RF-014 — Calificaciones y planilla académica

**Prioridad:** P0.  
**Actores:** ACT-02.  
**Dependencias:** RF-010, RF-013.

El sistema deberá presentar los resultados y calcular las calificaciones mediante una escala configurable. Los puntos adicionales se suman al puntaje obtenido sin aumentar el denominador ordinario. El porcentaje interno puede superar el 100 %, pero la calificación formal no superará la máxima configurada.

**Criterios de aceptación:**

- **CA1:** la planilla distingue resultados pendientes, puntuaciones ordinarias y puntos fuera de escala.
- **CA2:** con una escala configurada y documentada para la prueba, los casos de conversión producen los valores esperados según sus límites y regla de redondeo; se prueban al menos dos configuraciones para verificar que no existe una escala fija incorporada al cálculo.
- **CA3:** corregir un resultado actualiza los totales y la calificación que dependen de él.
- **CA4:** para el mismo estudiante y contexto, los valores coinciden en la planilla y en los informes que los incluyan.
- **CA5:** la configuración identifica los valores o límites de la escala y las reglas de conversión y redondeo necesarias para obtener una nota reproducible; una configuración incompleta o incoherente no permite emitir una calificación formal.
- **CA6:** para 20 puntos ordinarios posibles, 20 ordinarios obtenidos y 3 adicionales, se conserva el porcentaje interno de 115 % y se emite la calificación máxima de la escala configurada, sin excederla.
- **CA7:** un resultado pendiente conserva ese estado y no se almacena ni presenta como cero; los acumulados basados en datos parciales se identifican como tales.
- **CA8:** cuando el denominador ordinario es cero, no se divide por cero ni se emite una calificación formal ficticia; se muestra que no existe base ordinaria para calcularla.
- **CA9:** confirmar un cambio de máximo actualiza de forma consistente las calificaciones afectadas, la planilla y sus reportes; cancelar no cambia los valores.

### 4.3. Asistencia y seguimiento del estudiante

#### RF-015 — Registro de asistencia

**Prioridad:** P0.  
**Actores:** ACT-02.  
**Dependencias:** RF-007, RF-008.

El sistema deberá permitir registrar, consultar y corregir la asistencia mediante sesiones de clase vinculadas a una asignación Docente–Curso–Materia. Cada sesión tendrá registros individuales de asistencia de los estudiantes matriculados en su curso y año lectivo, con estado, justificación independiente y observaciones.

**Criterios de aceptación:**

- **CA1:** cada registro individual identifica estudiante y matrícula, sesión de clase, estado, justificación y observación cuando exista; la sesión identifica fecha y asignación Docente–Curso–Materia.
- **CA2:** existe como máximo un registro individual por sesión y matrícula; corregirlo actualiza ese registro sin duplicarlo.
- **CA3:** una fecha sin registros no se interpreta automáticamente como ausencia de todos los estudiantes.
- **CA4:** los estados mínimos disponibles son `PRESENTE`, `AUSENTE`, `LLEGADA_TARDIA` y `SALIDA_ANTICIPADA`; la unidad de registro es la sesión de clase definida en D-02.
- **CA5:** la justificación se guarda separadamente del estado y admite una observación complementaria; no existe un estado sustitutivo denominado «JUSTIFICADO».
- **CA6:** marcar como justificada una ausencia conserva `AUSENTE`; justificar una llegada tardía conserva `LLEGADA_TARDIA`. Al consultar e imprimir se muestran el estado y la justificación de forma diferenciada.
- **CA7:** pueden guardarse y recuperarse registros de prueba con cada uno de los cuatro estados mínimos; modificar la justificación no crea otro registro de asistencia.
- **CA8:** dos sesiones distintas de una misma fecha mantienen registros independientes; no se permite registrar asistencia de una matrícula ajena al curso o año lectivo de la sesión.

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
- **CA5:** al relacionar estudiantes, se valida su matrícula en el curso y año lectivo del informe y el permiso de acceso. Dejarlos sin indicar es válido y no requiere identificar un responsable individual.
- **CA6:** la evidencia puede omitirse; si se aporta, queda asociada al informe y solo puede consultarse por usuarios autorizados para ese registro.
- **CA7:** el informe puede consultarse e imprimirse conservando los datos registrados, la identificación de la evidencia si existe y los estudiantes relacionados cuando se hayan indicado; la ausencia de campos opcionales no impide imprimirlo.
- **CA8:** registrar un acontecimiento grupal no crea automáticamente ausencias, registros de conducta ni modificaciones de calificaciones individuales.
- **CA9:** puede guardarse y recuperarse un informe con cada categoría inicial: `AUSENCIA_COLECTIVA`, `RETIRO_COLECTIVO`, `COMPORTAMIENTO_GRUPAL`, `EVENTO_INSTITUCIONAL`, `INCIDENTE_GRUPAL` y `OTRO`. Al seleccionar `OTRO`, se permite describir la categoría o situación en la descripción del informe; ese texto se conserva al consultar e imprimir.
- **CA10:** se admiten de cero a tres evidencias por informe en formatos JPG, PNG o PDF, de hasta 5 MB por archivo; se rechaza una cuarta evidencia, un formato distinto o un archivo que exceda el límite, sin perder los registros válidos existentes.

### 4.4. Consulta, reportes e intercambio de información

#### RF-019 — Búsqueda y filtros

**Prioridad:** P1.  
**Actores:** ACT-01, ACT-02.  
**Dependencias:** RF-002, RF-007, RF-008, RF-009, RF-011, RF-013, RF-015, RF-016, RF-017, RF-018.

El sistema deberá permitir buscar y filtrar los listados incluidos en el alcance mediante los campos pertinentes de cada módulo.

**Criterios de aceptación:**

- **CA1:** al buscar un estudiante por nombre o cédula, se devuelven únicamente coincidencias autorizadas.
- **CA2:** los filtros de institución, año lectivo, curso, materia y fechas, cuando correspondan, se aplican conjuntamente sin mezclar matrículas de distintos contextos.
- **CA3:** quitar los filtros restablece el listado permitido, sin ampliar los permisos.
- **CA4:** una búsqueda sin coincidencias presenta un resultado vacío, sin mostrar registros de otro ámbito.

#### RF-020 — Reportes e impresión

**Prioridad:** P1.  
**Actores:** ACT-01, ACT-02, según permisos.  
**Dependencias:** RF-003, RF-005, RF-006, RF-008, RF-009, RF-013, RF-014, RF-015, RF-016, RF-017, RF-018, RF-028, RF-029. Cada reporte utiliza únicamente los módulos fuente que correspondan a su contenido.

El sistema deberá generar reportes mediante impresión y salida PDF de, como mínimo:

- Reporte académico individual.
- Reporte académico por curso.
- Reporte académico por materia.
- Reportes de tareas, evaluaciones y calificaciones.
- Asistencia diaria y por período.
- Conducta y registros anecdóticos.
- Informes grupales de acontecimientos definidos en RF-018.
- Planificación anual y planificación diaria.

**Criterios de aceptación:**

- **CA1:** la asistencia puede imprimirse o guardarse como PDF para un día o un intervalo de fechas, manteniendo identificables las sesiones de clase incluidas.
- **CA2:** el reporte de asistencia incluye únicamente fechas registradas dentro del intervalo seleccionado.
- **CA3:** los registros anecdóticos y de conducta pueden imprimirse por estudiante.
- **CA4:** las planillas de calificaciones conservan su contexto y valores; los informes grupales imprimen los acontecimientos registrados en RF-018 sin exigir registros individuales previos.
- **CA5:** la salida no corta nombres, columnas ni datos esenciales en el formato de página utilizado para impresión y PDF.
- **CA6:** se genera un reporte académico individual y reportes académicos por curso y por materia; sus datos coinciden con las fuentes y con el ámbito seleccionado.
- **CA7:** los reportes de tareas, evaluaciones y calificaciones incluyen los registros seleccionados sin confundir resultados pendientes con cero, ni sumar dos veces una evaluación vinculada a una tarea.
- **CA8:** las planificaciones anual y diaria se imprimen con su contenido guardado y la identificación de institución, curso, materia y año o fecha, según corresponda.
- **CA9:** todos los reportes respetan los permisos, el ámbito y los filtros aplicables; la desactivación de una entidad no elimina sus datos históricos de los reportes autorizados.
- **CA10:** los reportes de asistencia distinguen los cuatro estados mínimos y la justificación complementaria, con su observación cuando exista.
- **CA11:** se verifica al menos una salida imprimible y un PDF legible de cada tipo de reporte enumerado; los campos opcionales no informados y la ausencia de registros se presentan sin inventar información.

#### RF-021 — Consulta pública por cédula

**Prioridad:** P1.  
**Actores:** ACT-03.  
**Dependencias:** RF-003, RF-005, RF-008, RF-009, RF-013, RF-014; RF-015 únicamente para el resumen de asistencia habilitado por la institución.

El sistema deberá permitir la consulta pública por cédula exclusivamente de información académica expresamente autorizada del año lectivo activo, conforme a D-06. La autorización para mostrar un campo debe existir; su mera disponibilidad en el sistema no lo hace público.

**Criterios de aceptación:**

- **CA1:** una cédula con información habilitada devuelve únicamente campos expresamente autorizados de esta lista: identificación básica del estudiante, curso, materia, tareas, evaluaciones, puntos, calificación/rendimiento y estado pendiente, del año lectivo activo en el contexto institucional correspondiente.
- **CA2:** ni la interfaz ni la respuesta pública de la API incluyen conducta, registros anecdóticos, informes grupales, observaciones internas, datos privados del docente, IDs internos, auditoría o información administrativa.
- **CA3:** la consulta no permite modificar datos.
- **CA4:** una cédula inexistente o sin información habilitada no revela datos privados ni listados alternativos.
- **CA5:** las consultas aplican rate limiting; al superar el límite configurado de prueba se responde con rechazo controlado, sin devolver información académica adicional.
- **CA6:** el resumen de asistencia solo se devuelve cuando la institución lo habilita expresamente; aun habilitado, no incluye observaciones internas ni texto de justificaciones.
- **CA7:** una consulta con datos históricos disponibles no devuelve registros de años lectivos anteriores ni permite recuperarlos alterando parámetros; el año activo se determina en el backend.
- **CA8:** la ausencia de autorización, de año lectivo activo aplicable o de coincidencia válida no expone datos; la consulta nunca sustituye la autorización mediante posesión de un UUID interno.

La cédula es un identificador de búsqueda; no constituye por sí sola una credencial de autenticación.

#### RF-022 — Importación de datos

**Prioridad:** P1.  
**Actores:** ACT-01, ACT-02, según permisos.  
**Dependencias:** RF-007, RF-008.

El sistema deberá importar los datos comprendidos en el alcance V1.0 mediante CSV y XLSX, con vista previa, validación por fila, identificación de duplicados y confirmación de registros válidos. La lectura o vista previa no escribirá registros definitivos.

**Criterios de aceptación:**

- **CA1:** un CSV y un XLSX válidos pueden cargarse y visualizarse antes de confirmar; solo después de la confirmación se incorporan las filas válidas seleccionadas al ámbito autorizado.
- **CA2:** los datos importados respetan las mismas validaciones que el registro manual.
- **CA3:** un archivo inválido informa los errores identificables sin indicar falsamente que la importación fue exitosa.
- **CA4:** la vista previa identifica filas válidas, inválidas y duplicadas dentro del archivo o contra datos existentes; se puede confirmar únicamente las válidas y excluir las demás, sin sobrescribir registros existentes silenciosamente.
- **CA5:** no se importan datos a cursos o instituciones fuera de los permisos del usuario.
- **CA6:** cancelar la vista previa deja los datos persistentes sin cambios; confirmar un archivo mixto incorpora exactamente las filas válidas seleccionadas e informa las incorporadas y rechazadas con sus motivos.
- **CA7:** antes de persistir se revalidan permisos, relaciones y duplicidades; las filas que ya no sean válidas no se insertan, aunque hubieran resultado válidas en la vista previa.
- **CA8:** los duplicados se verifican conforme a UUID, cédula disponible, matrícula y demás restricciones del módulo; no se considera que todos los estudiantes sin cédula sean la misma persona.

La lectura de mallas curriculares se especifica separadamente en RF-027.

#### RF-023 — Exportación de datos

**Prioridad:** P1.  
**Actores:** ACT-01, ACT-02, según permisos.  
**Dependencias:** RF-019 para datos tabulares; RF-020 para salidas de reportes.

El sistema deberá exportar datos tabulares autorizados en CSV y XLSX. Los reportes se obtendrán mediante impresión y PDF conforme a RF-020, sin duplicar su generación en otro módulo.

**Criterios de aceptación:**

- **CA1:** un mismo conjunto tabular autorizado puede exportarse como CSV y XLSX; ambos archivos abren correctamente y conservan los mismos registros y valores.
- **CA2:** sus registros coinciden con el ámbito y los filtros seleccionados.
- **CA3:** no incluye datos de instituciones o asignaciones ajenas.
- **CA4:** conserva identificadores, fechas y puntuaciones sin cambios de significado ni pérdida de precisión respecto del contrato de exportación.
- **CA5:** las salidas de reportes utilizan impresión/PDF de RF-020; exportar información privada exige permisos y ámbito, y no se ofrece como forma de ampliar los datos de RF-021.

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

- **CA1:** las altas de administradores, los cambios de roles, permisos, ámbitos, asignaciones, activación/desactivación de entidades, máximos de puntuación, resultados académicos, asistencia, registros de seguimiento e informes grupales generan una entrada con fecha, actor, acción, entidad afectada y resultado.
- **CA2:** los intentos de autenticación generan registros sin guardar contraseñas ni cookies de sesión.
- **CA3:** las importaciones y restauraciones registran su ejecución y resultado cuando corresponda.
- **CA4:** un docente o consultante público no puede modificar ni eliminar las entradas de auditoría.
- **CA5:** el responsable autorizado puede recuperar las entradas necesarias para verificar una operación de prueba.
- **CA6:** la delegación administrativa registra actor, destinatario, permisos y ámbito concedidos o rechazados; el uso excepcional de la cuenta raíz/técnica deja evidencia de la acción y su motivo.
- **CA7:** la modificación confirmada de un máximo con resultados conserva valor anterior, valor nuevo, actor y resultado del recálculo, sin incluir contraseñas ni secretos.

### 4.5. Currículo y planificación

#### RF-026 — Base curricular delimitada

**Prioridad:** P1.  
**Actores:** ACT-01, ACT-02, según permisos.  
**Dependencias:** RF-005, RF-006.

El sistema deberá almacenar y consultar exclusivamente fuentes oficiales o expresamente validadas para la base curricular de Matemática Aplicada y Algorítmica de 1.º–3.º BTI.

**Criterios de aceptación:**

- **CA1:** se dispone de las seis combinaciones materia–año con las fuentes curriculares validadas.
- **CA2:** cada elemento curricular conserva materia, año y documento de origen, con página o sección cuando sea posible; si no existe un localizador verificable, no se inventa.
- **CA3:** consultar una combinación no mezcla sus elementos con los de otra.
- **CA4:** cada documento incorporado se identifica como oficial o expresamente validado; los elementos almacenados coinciden con la fuente revisada y no se incorpora una fuente sin ninguna de esas condiciones.

#### RF-027 — Lectura controlada de mallas

**Prioridad:** P1.  
**Actores:** ACT-01, ACT-02, según permisos.  
**Dependencias:** RF-026.

El sistema deberá permitir la lectura e incorporación controlada de las mallas contempladas en V1.0 mediante la secuencia: documento soportado → extracción → vista previa → revisión humana → corrección si corresponde → confirmación → almacenamiento. La extracción nunca modificará automáticamente la base curricular.

**Criterios de aceptación:**

- **CA1:** un documento de formato y estructura soportados y documentados recorre extracción, vista previa, revisión humana, corrección si corresponde y confirmación antes del almacenamiento; se verifica que la base curricular permanezca intacta hasta confirmar.
- **CA2:** los elementos reconocidos pueden comprobarse y corregirse antes de su confirmación.
- **CA3:** la lectura por sí sola no modifica la base curricular vigente.
- **CA4:** un documento no admitido informa la limitación sin inventar contenido curricular.
- **CA5:** después de confirmar, se almacenan los elementos revisados con las correcciones realizadas y su referencia de origen; una consulta posterior recupera ese contenido confirmado.
- **CA6:** no se puede confirmar una extracción sin revisión humana; cancelar antes de confirmar deja intacta la base curricular y el proceso no admite fuentes fuera de RF-026.

#### RF-028 — Planificación anual

**Prioridad:** P1.  
**Actores:** ACT-02.  
**Dependencias:** RF-007, RF-026.

El sistema deberá permitir crear, consultar y modificar la planificación anual de una asignación utilizando la base curricular correspondiente.

**Criterios de aceptación:**

- **CA1:** la planificación identifica docente, asignación, institución, curso y año lectivo, respetando el contexto académico de D-02.
- **CA2:** los elementos curriculares vinculados pertenecen a la materia y al año correspondientes.
- **CA3:** la organización temporal guardada se recupera sin alteraciones.
- **CA4:** modificar una planificación no modifica otras asignaciones ni la base curricular de origen.
- **CA5:** cada entrada de planificación anual conserva unidad, capacidad, contenido, indicadores, horas planificadas, período estimado y estado; todos esos campos se recuperan al consultar el plan.

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
- **CA5:** la planificación diaria conserva fecha, duración, tema, capacidad, indicadores, inicio, desarrollo, cierre, recursos, evidencias, evaluación y estado; se recuperan esos campos sin modificar automáticamente registros de evaluación académica.

#### RF-030 — Seguimiento curricular

**Prioridad:** P1.  
**Actores:** ACT-02.  
**Dependencias:** RF-028, RF-029.

El sistema deberá permitir registrar lo desarrollado y compararlo con lo planificado. El indicador principal será horas desarrolladas / horas planificadas × 100, para el mismo ámbito curricular y período. Mostrará también, cuando corresponda, horas planificadas, desarrolladas y pendientes.

**Criterios de aceptación:**

- **CA1:** el docente puede registrar las horas efectivamente desarrolladas para un elemento curricular vinculado a su planificación, distinguiéndolas de las horas planificadas.
- **CA2:** la consulta muestra, cuando corresponda, horas planificadas, horas efectivamente desarrolladas y horas pendientes para el mismo ámbito y período. Las pendientes se calculan como máximo(horas planificadas − horas desarrolladas, 0), sin valores negativos.
- **CA3:** crear una planificación no marca automáticamente su contenido como desarrollado.
- **CA4:** con 40 horas planificadas y 10 desarrolladas, se muestran 40 planificadas, 10 desarrolladas, 30 pendientes y 25 % de avance. Con 40 desarrolladas, se muestran 0 pendientes y 100 %. Con 45 desarrolladas, se muestran 0 pendientes y 112,5 %, conservando la fórmula de avance. El cálculo utiliza el mismo ámbito y período, unidades consistentes y no cuenta dos veces el mismo registro de desarrollo.
- **CA5:** con cero horas planificadas el porcentaje se muestra como no calculable, sin dividir por cero ni inventar un 0 % o 100 %; se rechazan horas negativas.
- **CA6:** cuando las horas desarrolladas superan a las planificadas, se conserva el resultado de la fórmula; corregir las horas actualiza el indicador sin modificar por sí solo el plan ni las calificaciones.

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

- **CA1:** Administración visualiza únicamente recursos permitidos por sus roles, permisos explícitos y ámbito; el acceso docente muestra únicamente sus asignaciones.
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
- **CA4:** la vista diferencia la matrícula, institución, año lectivo, curso y materia de los registros cuando corresponda; los vínculos entre tareas y evaluaciones no duplican resultados.
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
- **CA5:** la autorización combina roles, permisos explícitos y ámbito en el backend, deniega por defecto y comprueba que toda delegación sea subconjunto de los permisos y ámbito del actor.
- **CA6:** las pruebas cubren administradores de la misma institución con ámbitos distintos, delegación excesiva y usuarios con varios roles; ningún caso obtiene permisos globales por acumulación de roles.
- **CA7:** el banco privado de un docente no queda expuesto por permisos administrativos cotidianos; las respuestas públicas usan exclusivamente la lista autorizada de D-06.

### RNF-004 — Seguridad de solicitudes y exposición

**Prioridad:** P0.  
**Ámbito:** RF-001, RF-021, RF-022, RF-027, RF-031 y operaciones de escritura.

**Criterios de aceptación:**

- **CA1:** las solicitudes de modificación con cookies están protegidas frente a CSRF mediante una estrategia documentada y probada.
- **CA2:** CORS permite únicamente los orígenes configurados para el entorno.
- **CA3:** las entradas de prueba con scripts no ejecutan contenido al mostrarse en la aplicación.
- **CA4:** las consultas a la base de datos evitan concatenar entradas del usuario como instrucciones SQL.
- **CA5:** autenticación, consulta pública y solicitudes de IA aplican límites documentados; al superarlos rechazan nuevas solicitudes de forma controlada.
- **CA6:** la importación tabular admite CSV/XLSX; las evidencias grupales admiten JPG/PNG/PDF, hasta 5 MB por archivo y tres archivos por informe. El backend valida tipo real, tamaño y cantidad, y exige autorización para consultar evidencias, sin confiar únicamente en la extensión.
- **CA7:** los errores externos no muestran trazas internas ni secretos.

### RNF-005 — Validación e integridad de datos

**Prioridad:** P0.  
**Ámbito:** todos los RF que escriben datos.

**Criterios de aceptación:**

- **CA1:** entradas inválidas enviadas directamente a la API son rechazadas mediante validación del backend.
- **CA2:** las relaciones obligatorias no admiten referencias a entidades inexistentes.
- **CA3:** se verifican restricciones contra duplicidades de cuentas, cursos por contexto, cédulas disponibles, matrículas, asignaciones, resultados y registros de asistencia por sesión y matrícula.
- **CA4:** una operación atómica que falla no deja registros parcialmente aplicados. La importación parcial admite filas válidas confirmadas y excluye inválidas, sin dejar una fila aceptada con relaciones incompletas.
- **CA5:** no se permite eliminar o modificar información de forma que deje registros académicos sin sus referencias necesarias.
- **CA6:** la desactivación de instituciones, docentes, cursos, materias y estudiantes conserva sus relaciones históricas; las restricciones de integridad impiden su eliminación física cuando existen esas relaciones.
- **CA7:** las entidades utilizan identificadores internos UUID; la cédula opcional es única cuando existe y nunca es clave primaria. Se verifica la coherencia de curso, matrícula, año lectivo, asignación y sesión de clase.

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
- **CA5:** el procedimiento de bootstrap crea o configura de forma segura la cuenta raíz/técnica sin credenciales fijas en el repositorio; documenta su uso excepcional y la utilización de cuentas con ámbito para el trabajo cotidiano.

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
- **CA7:** se prueban delegación por subconjuntos de permisos y ámbito, identidad separada de matrícula, asistencia por sesión, porcentaje académico superior al 100 % con nota limitada, importación parcial CSV/XLSX, límites de evidencia, contrato público del año activo y avance curricular por horas.

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
- **CA9:** Playwright verifica una delegación permitida y otra rechazada, la vista previa y confirmación parcial de importación, la ausencia de campos prohibidos en consulta pública y el flujo completo de revisión humana de mallas.

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
- **CA2:** diferencia las operaciones disponibles según roles, permisos explícitos y ámbito, explica los límites de delegación y el carácter privado del banco docente.
- **CA3:** explica escala configurable y límite de nota formal, puntos fuera de escala, resultados pendientes, matrículas, sesiones de asistencia, importación con confirmación parcial, límites de evidencia, consulta pública del año activo y cálculo del avance por horas.
- **CA4:** un revisor puede ejecutar los recorridos documentados sin instrucciones adicionales.
- **CA5:** capturas, términos y procedimientos corresponden a la versión entregada.

### RNF-014 — Manual Técnico

**Prioridad:** P2.  
**Ámbito:** instalación, arquitectura, seguridad y operación.

**Criterios de aceptación:**

- **CA1:** documenta módulos, UUID, modelo de datos y matrículas/sesiones, API, variables de entorno, roles/permisos/ámbitos, delegación y decisiones de seguridad.
- **CA2:** contiene procedimientos de instalación, migraciones, pruebas, respaldo y restauración.
- **CA3:** explica la integración con OpenAI sin incluir secretos reales.
- **CA4:** permite reproducir RNF-009 y el ensayo de RF-024.
- **CA5:** documenta bootstrap y uso excepcional de la cuenta raíz/técnica, configuración reproducible de escalas, contratos de CSV/XLSX, formatos de mallas soportados, validación de evidencias y límites de consultas públicas, sin ampliar el alcance funcional.

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
| Acceso | RF-001–RF-002 | Sesión; roles, permisos, ámbito y delegación limitada. |
| Estructura institucional | RF-003–RF-008 | Acceso, instituciones, docentes, cursos y materias. |
| Gestión académica | RF-009–RF-014 | Asignaciones y estudiantes. |
| Seguimiento del estudiante | RF-015–RF-017 | Asignaciones, matrículas y sesiones de clase para asistencia. |
| Acontecimientos grupales | RF-018 | Institución, docente y curso autorizado; sin registros individuales previos. |
| Consulta e intercambio | RF-019–RF-023 | Datos académicos, ámbitos, año lectivo activo para consulta pública y contratos de importación/exportación. |
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

## 7. Decisiones D-01 a D-07 — RESUELTAS

Las siete decisiones quedan cerradas por definición expresa del usuario. Las configuraciones institucionales y los contratos técnicos necesarios para implementarlas deberán documentarse y probarse; no constituyen autorización para añadir funcionalidades ni para reabrir estas decisiones.

| ID | Estado | Decisión | Requisitos principalmente afectados |
|---|---|---|---|
| D-01 | RESUELTA | Administración jerárquica por roles, permisos y ámbito; delegación limitada; banco privado por docente. | RF-002–RF-004, RF-011–RF-012, RF-025, RF-033–RF-034; RNF-003, RNF-009, RNF-014 |
| D-02 | RESUELTA | Contexto académico completo, UUID, estudiante independiente de matrícula y asistencia por sesión. | RF-005, RF-007–RF-008, RF-013, RF-015, RF-018–RF-022, RF-028, RF-034; RNF-005 |
| D-03 | RESUELTA | Escala configurable, adicionales sin aumentar denominador, nota formal limitada y cambio de máximo confirmado y auditado. | RF-009–RF-010, RF-013–RF-014, RF-020–RF-021, RF-025 |
| D-04 | RESUELTA | Cuatro estados mínimos de asistencia y justificación independiente. | RF-015, RF-020–RF-021, RF-033–RF-034 |
| D-05 | RESUELTA | Importación CSV/XLSX revisable y parcial; exportación tabular e impresión/PDF; categorías y evidencias grupales delimitadas. | RF-018, RF-020, RF-022–RF-023; RNF-004–RNF-005 |
| D-06 | RESUELTA | Consulta pública solo de información académica autorizada del año lectivo activo, con exclusiones y rate limiting. | RF-021; RNF-003–RNF-004 |
| D-07 | RESUELTA | Fuentes oficiales o validadas, extracción revisada por una persona, campos de planificación y avance por horas. | RF-026–RF-032; RNF-010–RNF-014 |

### 7.1. D-01 — Administración jerárquica y delegable

- Cada administrador tendrá uno o más roles, permisos explícitos y un ámbito.
- El ámbito podrá ser una institución completa, uno o varios cursos/secciones o recursos específicos según permisos.
- Tener un rol administrativo no otorgará privilegios globales automáticamente.
- Solo un administrador autorizado para delegar podrá crear otros administradores, con ámbito igual o más restringido y sin conceder permisos que no posea en ese ámbito. La misma restricción rige cualquier modificación de concesiones.
- Se aplicará mínimo privilegio: una operación exige permiso explícito y pertenencia del recurso al ámbito autorizado.
- Las acciones administrativas relevantes se auditarán.
- La cuenta raíz/técnica se permitirá exclusivamente para bootstrap y administración excepcional, no para trabajo cotidiano.
- El banco de actividades será privado por docente en V1.0. La administración cotidiana no concede acceso al banco de otros docentes.

### 7.2. D-02 — Contexto académico e identidad

El contexto será **Institución + Año Lectivo + Año/Grado + Sección + Turno**.

- El estudiante será una entidad independiente de su matrícula.
- Cada matrícula vinculará **Estudiante + Curso + Año Lectivo** y conservará su contexto histórico.
- Se utilizarán UUID internos como identificadores. La cédula será única cuando esté disponible y nunca será la clave primaria.
- Se admitirán estudiantes sin cédula, sin reemplazarla por un identificador ficticio. Incorporar posteriormente la cédula no cambiará el UUID.
- La asistencia se registrará en una sesión de clase vinculada a una asignación Docente–Curso–Materia, con registros individuales por matrícula.
- Varias sesiones de una misma fecha conservarán sus registros independientes; fecha y estudiante por sí solos no identifican una asistencia.

### 7.3. D-03 — Calificaciones

La escala será configurable; no se fija una escala institucional universal ni umbrales o redondeos no indicados por el usuario. Cada configuración utilizada deberá definir una conversión reproducible y documentada antes de emitir notas formales.

Para un conjunto académico con denominador ordinario positivo:

- Puntaje obtenido total = puntaje ordinario obtenido + puntos fuera de escala obtenidos.
- Porcentaje interno = puntaje obtenido total / puntaje máximo ordinario × 100.
- Los puntos fuera de escala no incrementarán el puntaje máximo ordinario.
- El porcentaje interno podrá superar el 100 %.
- La calificación formal resultará de la conversión de la escala configurada y nunca superará su valor máximo; un porcentaje superior al 100 % corresponderá al máximo formal.
- Un resultado pendiente no equivaldrá a cero. Los resultados parciales deberán conservar esa condición.
- Sin denominador ordinario positivo no se emitirá un cálculo ficticio.
- Si se cambia el máximo de una actividad con resultados, se advertirá al docente, se requerirá confirmación y se recalculará cuando corresponda, con auditoría. Cancelar conservará los datos anteriores. Los puntajes obtenidos no se sustituirán silenciosamente.

Casos verificables sin imponer una escala particular:

| Máximo ordinario | Ordinarios obtenidos | Adicionales obtenidos | Total | Porcentaje interno | Regla formal |
|---|---|---|---|---|---|
| 20 | 15 | 3 | 18 | 90 % | Conversión de 90 % según escala configurada. |
| 20 | 20 | 3 | 23 | 115 % | Máxima calificación configurada. |
| 0 | 0 | 3 | 3 | No calculable | Sin nota formal derivada de una división por cero. |

### 7.4. D-04 — Estados de asistencia

| Estado mínimo | Significado |
|---|---|
| `PRESENTE` | Presencia registrada en la sesión. |
| `AUSENTE` | Ausencia registrada en la sesión. |
| `LLEGADA_TARDIA` | Asistencia con llegada posterior al inicio de la sesión. |
| `SALIDA_ANTICIPADA` | Asistencia con salida anterior a la finalización de la sesión. |

La justificación será un atributo independiente y podrá incluir observación. Justificar una ausencia no la convierte en presencia ni sustituye `AUSENTE` por un estado denominado «JUSTIFICADO».

### 7.5. D-05 — Importación, exportación e informe grupal

**Estado: RESUELTA.**

**Importación:** CSV y XLSX, con vista previa obligatoria antes de confirmar, validación por fila e identificación de duplicados. El sistema mostrará registros válidos, duplicados e inválidos; el usuario autorizado podrá confirmar únicamente los válidos. La confirmación no autoriza sobrescrituras silenciosas ni omite la revalidación de permisos, relaciones y unicidad.

Los contratos de columnas deberán corresponder a entidades y datos ya comprendidos en V1.0. Esta decisión no incorpora un importador universal de entidades ni reemplaza la lectura controlada de mallas de RF-027.

**Exportación:** CSV/XLSX para datos tabulares; impresión/PDF para los reportes de RF-020.

**Categorías iniciales del informe grupal:**

- `AUSENCIA_COLECTIVA`
- `RETIRO_COLECTIVO`
- `COMPORTAMIENTO_GRUPAL`
- `EVENTO_INSTITUCIONAL`
- `INCIDENTE_GRUPAL`
- `OTRO`

Al utilizar `OTRO`, se permitirá describir la categoría o situación correspondiente en la descripción del informe.

**Evidencias:** JPG, PNG o PDF; máximo 5 MB por archivo y máximo tres evidencias por informe. Para verificar el límite de forma reproducible, 5 MB se interpreta como 5 000 000 bytes. Se admite un informe sin evidencias.

Se mantiene RF-018 como registro de acontecimientos del curso, con materia y estudiantes relacionados opcionales, sin registros individuales previos ni atribución obligatoria de responsabilidad.

### 7.6. D-06 — Consulta pública

**Estado: RESUELTA.**

Solo se mostrará información académica expresamente autorizada del año lectivo activo en el contexto institucional consultado. Se permitirá publicar únicamente los campos autorizados de la lista siguiente:

- Identificación básica del estudiante.
- Curso y materia.
- Tareas y evaluaciones.
- Puntos y calificación/rendimiento.
- Estado pendiente.
- Resumen de asistencia, exclusivamente cuando la institución lo habilite.

Nunca se mostrarán públicamente:

- Conducta.
- Registros anecdóticos.
- Informes grupales ni sus evidencias.
- Observaciones internas, incluidas las observaciones de asistencia y justificación.
- Datos privados del docente.
- IDs internos.
- Auditoría.
- Información administrativa.

Las restricciones se aplicarán también al contenido de la respuesta de la API, no solo a la interfaz. La consulta por cédula aplicará rate limiting. La cédula será un identificador de búsqueda, no una credencial. Sin habilitación expresa no habrá publicación; los datos de años anteriores permanecerán fuera de esta consulta.

### 7.7. D-07 — Currículo y planificación

**Estado: RESUELTA.**

V1.0 utilizará exclusivamente fuentes curriculares oficiales o expresamente validadas para Matemática Aplicada y Algorítmica de 1.º, 2.º y 3.º BTI.

Cada elemento conservará referencia al documento y, cuando sea posible, a la página o sección. No se inventarán referencias ausentes.

El flujo obligatorio será:

**Documento soportado → extracción → vista previa → revisión humana → corrección si corresponde → confirmación → almacenamiento.**

La extracción nunca modificará automáticamente la base curricular.

Los formatos soportados se documentarán y comprobarán con las fuentes seleccionadas. No se presupone soporte universal, OCR universal ni incorporación automática sin revisión.

| Planificación anual | Planificación diaria |
|---|---|
| Unidad | Fecha |
| Capacidad | Duración |
| Contenido | Tema |
| Indicadores | Capacidad |
| Horas planificadas | Indicadores |
| Período estimado | Inicio |
| Estado | Desarrollo |
| — | Cierre |
| — | Recursos |
| — | Evidencias |
| — | Evaluación |
| — | Estado |

El avance curricular se calculará principalmente como:

**Avance curricular (%) = horas desarrolladas / horas planificadas × 100.**

Se mostrarán también, cuando corresponda, horas planificadas, horas desarrolladas y horas pendientes. Las horas pendientes serán máximo(horas planificadas − horas desarrolladas, 0); este límite inferior no recorta el porcentaje de avance cuando supera el 100 %.

Las horas comparadas deberán pertenecer al mismo ámbito y período, expresarse en unidades consistentes y proceder de registros de desarrollo efectivo, sin duplicaciones. Si las horas planificadas son cero, el porcentaje será no calculable. Crear o aprobar una planificación no registrará automáticamente horas desarrolladas.

## 8. Revisión de consistencia global

### 8.1. Cobertura del alcance

| Elemento solicitado | Requisitos |
|---|---|
| Autenticación, roles, permisos, ámbitos y delegación administrativa | RF-001–RF-002; RNF-002–RNF-004 |
| Cuenta raíz/técnica de uso excepcional | RF-002, RF-025; RNF-009, RNF-014 |
| Instituciones, docentes, cursos y materias | RF-003–RF-006 |
| Activación/desactivación y conservación histórica | RF-003–RF-008 según entidad; sección 2.3; RNF-005 |
| Asignación Docente–Curso–Materia | RF-007; RNF-003 |
| Estudiantes independientes de matrículas; UUID y cédula opcional única | RF-008; RNF-005 |
| Tareas y puntos fuera de escala | RF-009–RF-010 |
| Banco privado por docente y reutilización autorizada | RF-011–RF-012 |
| Evaluaciones independientes de tareas, escala configurable y recálculo confirmado | RF-009–RF-010, RF-013–RF-014, RF-025 |
| Asistencia por sesión, cuatro estados y justificación independiente | RF-015, RF-020; D-02 y D-04 |
| Registros anecdóticos y conducta | RF-016–RF-017, RF-020 |
| Informes grupales, seis categorías y evidencias limitadas | RF-018, RF-020; RNF-004 |
| Búsqueda y filtros | RF-019 |
| Reportes académicos individuales, por curso y materia; tareas, evaluaciones y calificaciones | RF-020 |
| Impresión de asistencia, conducta, registros anecdóticos e informes grupales | RF-020 |
| Impresión de planificación anual y diaria | RF-020, RF-028–RF-029 |
| Consulta pública autorizada del año lectivo activo y exclusiones | RF-021; RNF-003–RNF-004 |
| Importación CSV/XLSX con vista previa, duplicados y confirmación parcial | RF-022; RNF-005 |
| Exportación CSV/XLSX y reportes impresión/PDF | RF-020, RF-023 |
| Respaldos y auditoría | RF-024–RF-025 |
| Fuentes oficiales o validadas y lectura con revisión humana | RF-026–RF-027 |
| Matemática Aplicada y Algorítmica, 1.º–3.º BTI | RF-026 |
| Planificación anual y diaria | RF-028–RF-029 |
| Seguimiento curricular por horas desarrolladas/planificadas | RF-030 |
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
| Informe grupal | Registra hechos propios del curso, con vínculos opcionales y descripción de categoría o situación para OTRO; no agrega ni exige registros individuales. |
| Evaluaciones | Pueden crearse directamente en una asignación, sin tarea previa; los vínculos a actividades e instrumentos son opcionales. |
| Ciclo de vida | Las cinco entidades admiten activación/desactivación; se conserva el historial y se impide la eliminación física con relaciones históricas. |
| Asistencia | D-04 está resuelta con cuatro estados mínimos; la justificación es complementaria y no cambia el estado. |
| Dashboard y perfil | Consultan datos fuente autorizados, no duplican registros ni amplían la consulta pública. |
| Registros anecdóticos y conducta | Se distinguen semánticamente sin exigir almacenamiento duplicado. |
| Planificación y seguimiento | Planificar no implica registrar desarrollo efectivo. |
| IA | Generar una propuesta no implica aprobarla ni incorporarla automáticamente. |
| Consulta pública y privacidad | D-06 está resuelta: lista permitida con autorización expresa, año activo, asistencia optativa institucional, exclusión de datos internos y rate limiting. |
| Alcance de la revisión | Se conservan los 34 RF y 15 RNF; solo se ajustan reglas y criterios derivados de D-01 a D-07, sin añadir requisitos ni funcionalidades ajenas al alcance. |
| Conservación de RF/RNF en esta revisión | Solo RF-018, RF-027 y RF-030 reciben precisiones derivadas de D-05 y D-07; los 15 RNF permanecen intactos. |
| Decisiones | D-01 a D-07 están RESUELTAS y vinculadas a requisitos verificables. |
| Delegación y mínimo privilegio | Concesiones limitadas por permiso y ámbito; múltiples roles no otorgan privilegios globales ni acceso a bancos ajenos. |
| Identidad y contexto | UUID independiente de cédula; matrícula separada de estudiante; asistencia vinculada a sesión y asignación. |
| Calificaciones | Porcentaje interno superior al 100 % permitido; nota formal limitada; pendientes distintos de cero y cambio de máximo confirmado y auditado. |
| Importación parcial e integridad | Solo se confirman filas válidas; revalidación antes de persistir y ausencia de relaciones parcialmente creadas. |
| Currículo y horas | Extracción sin escritura automática, revisión y corrección antes de confirmar y almacenar; referencias de origen; horas planificadas, desarrolladas y pendientes; avance reproducible y tratamiento de denominador cero. |

### 8.3. Estado de la especificación

La revisión no identifica requisitos duplicados, referencias inexistentes ni contradicciones internas en la formulación presentada.

**D-01, D-02, D-03, D-04, D-05, D-06 y D-07 quedan formalmente RESUELTAS.** La especificación mantiene 34 RF y 15 RNF, sus prioridades y el alcance congelado. Los valores institucionales de configuración y contratos técnicos se documentarán al implementar las reglas aprobadas, sin introducir funcionalidades adicionales.

La revisión corresponde a la consistencia de la especificación. La aceptación de la aplicación requerirá ejecutar las comprobaciones de RNF-010 a RNF-012 y aportar sus evidencias; no se declara implementado ni probado el sistema por cerrar estas decisiones.

No se ha desarrollado código.
