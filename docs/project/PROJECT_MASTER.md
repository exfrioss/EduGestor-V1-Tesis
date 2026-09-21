# EduGestor V1.0 — Documento Maestro del Proyecto

**Proyecto:** EduGestor  
**Tipo:** Sistema Integral de Gestión y Planificación Docente  
**Uso principal:** Proyecto de tesis  
**Versión:** V1.0  
**Inicio formal del desarrollo:** 21/09/2026  
**Estado del alcance:** CONGELADO  
**Repositorio:** EduGestor-V1-Tesis  

---

# 1. Propósito

EduGestor es una aplicación web orientada a docentes e instituciones
educativas para centralizar la gestión académica, administrativa y
curricular.

El sistema permitirá gestionar estudiantes, cursos, materias, tareas,
evaluaciones, calificaciones, asistencia, conducta, registros anecdóticos,
informes y planificación docente.

Como elemento diferenciador, incorporará un módulo curricular y un
asistente pedagógico basado en inteligencia artificial para apoyar la
creación de planificaciones anuales y diarias.

La inteligencia artificial tendrá carácter asistencial:

IA genera propuesta → docente revisa → docente modifica → docente aprueba.

La IA nunca reemplazará automáticamente información curricular oficial.

---

# 2. Objetivo general

Desarrollar una aplicación web integral que facilite la gestión académica
y administrativa del docente mediante herramientas para seguimiento
estudiantil, evaluación, asistencia, elaboración de informes y
planificación curricular asistida por inteligencia artificial.

---

# 3. Principios del sistema

EduGestor V1.0 deberá respetar los siguientes principios:

1. Centralización de la información académica.
2. Seguridad y control de acceso.
3. Trazabilidad de las operaciones importantes.
4. Arquitectura modular.
5. Integridad de los datos.
6. Facilidad de uso para docentes.
7. Supervisión humana de las funciones basadas en IA.
8. Extensibilidad para futuras materias y funcionalidades.
9. Separación entre información curricular oficial y contenido generado.
10. Documentación paralela al desarrollo.

---

# 4. Actores

## 4.1 Administrador

Puede administrar:

- instituciones;
- usuarios;
- docentes;
- cursos;
- materias;
- asignaciones;
- estudiantes;
- configuraciones;
- mallas curriculares;
- respaldos;
- permisos;
- auditoría.

## 4.2 Docente

Puede trabajar únicamente con las instituciones, cursos y materias que
tenga asignados.

Puede gestionar:

- estudiantes;
- tareas;
- evaluaciones;
- calificaciones;
- asistencia;
- conducta;
- registros anecdóticos;
- informes;
- planificación curricular;
- planificación diaria.

## 4.3 Estudiante / Familia

Accede únicamente al módulo público autorizado de consulta.

No posee acceso al área administrativa.

---

# 5. Arquitectura tecnológica aprobada

## Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- React Router
- React Hook Form
- Zod
- TanStack Query

## Backend

- Node.js
- Express
- TypeScript
- API REST
- Zod para validación

## Base de datos

- PostgreSQL
- Prisma ORM
- Migraciones versionadas

## Autenticación y seguridad

- Contraseñas almacenadas mediante hashing seguro.
- Cookies HttpOnly para autenticación/sesión.
- Autorización en backend.
- Control de acceso basado en roles.
- Control adicional mediante asignaciones:
  Docente → Institución → Curso → Materia.
- Validación en frontend y backend.
- Principio de mínimo privilegio.

## Inteligencia Artificial

- OpenAI API.
- Consumo exclusivamente desde el backend.
- Las claves API nunca deben exponerse en frontend.
- El sistema debe permitir sustituir en el futuro el proveedor de IA.

## Infraestructura local

- Docker Desktop
- Docker Compose
- PostgreSQL ejecutado mediante contenedor.

## Pruebas

- Vitest
- React Testing Library
- Supertest
- Playwright para pruebas E2E

## Control de versiones

- Git
- GitHub privado durante el desarrollo.

---

# 6. Arquitectura general

La aplicación utilizará una arquitectura cliente-servidor.

Flujo principal:

Usuario
→ Frontend React
→ API REST
→ Backend Node/Express
→ Prisma
→ PostgreSQL

Las funciones de inteligencia artificial seguirán:

Frontend
→ Backend
→ Servicio de IA
→ OpenAI API
→ Backend
→ propuesta al docente
→ revisión humana
→ aprobación
→ persistencia.

El navegador no accederá directamente a PostgreSQL.

---

# 7. Estructura principal del dominio

La aplicación deberá soportar relaciones como:

Institución
→ Curso
→ Materia
→ Docente
→ Estudiante

La asignación docente deberá estar definida como:

Docente
→ Institución
→ Curso
→ Materia
→ Año lectivo

Esto permitirá que un mismo docente trabaje en distintas instituciones,
cursos y materias sin acceder a información que no le corresponda.

---

# 8. Alcance funcional V1.0

## 8.1 Autenticación y usuarios

- Inicio de sesión.
- Cierre de sesión.
- Usuarios individuales.
- Administrador.
- Docente.
- Activación/desactivación.
- Recuperación o restablecimiento de contraseña.
- Protección de rutas.
- Sesiones seguras.

## 8.2 Roles y permisos

- Administrador.
- Docente.
- Restricción por institución.
- Restricción por curso.
- Restricción por materia.
- Validación de permisos en backend.

## 8.3 Instituciones

- Crear.
- Consultar.
- Modificar.
- Activar/desactivar.
- Relacionar con cursos, docentes y estudiantes.

## 8.4 Docentes

- Registrar.
- Editar.
- Activar/desactivar.
- Asignar institución.
- Asignar curso.
- Asignar materia.
- Consultar asignaciones.

## 8.5 Cursos

- Crear.
- Editar.
- Activar/desactivar.
- Asociar a institución.
- Asociar materias.
- Asociar docentes.
- Asociar estudiantes.

## 8.6 Materias

- Crear.
- Editar.
- Asociar a cursos.
- Asociar a docentes.
- Separar registros académicos por materia.

## 8.7 Estudiantes

- Registrar.
- Editar.
- Activar/desactivar.
- Número de cédula.
- Prevención de duplicados.
- Institución.
- Curso.
- Perfil individual.
- Historial académico.

## 8.8 Tareas y actividades

- Crear.
- Editar.
- Eliminar.
- Fecha.
- Descripción.
- Puntaje.
- Curso.
- Materia.
- Indicadores.
- Registro de resultados.
- Actividades pendientes.

## 8.9 Puntos fuera de escala

El sistema deberá diferenciar:

- puntos ordinarios;
- puntos extraordinarios;
- puntaje acumulado.

Los puntos extraordinarios podrán incrementar el resultado del estudiante
sin modificar necesariamente la escala ordinaria.

## 8.10 Reutilización de actividades

El docente podrá:

- duplicar actividades;
- reutilizar actividades en otros cursos;
- reutilizar en varias secciones;
- modificar fecha;
- modificar puntaje;
- conservar indicadores;
- conservar descripción.

Las copias deberán ser independientes del original.

## 8.11 Banco de actividades

Repositorio reutilizable de:

- tareas;
- evaluaciones;
- rúbricas;
- actividades;
- materiales asociados.

## 8.12 Evaluaciones

- Crear.
- Editar.
- Fecha.
- Tipo.
- Puntaje.
- Resultados.
- Indicadores.
- Puntos extraordinarios.
- Porcentaje de rendimiento.

## 8.13 Calificaciones

- Consolidación de tareas y evaluaciones.
- Puntaje acumulado.
- Puntaje posible.
- Puntos extraordinarios.
- Porcentaje.
- Calificación.
- Vista individual.
- Vista por curso.
- Vista por materia.

## 8.14 Perfil académico del estudiante

Debe centralizar:

- datos personales básicos;
- curso;
- materias;
- tareas;
- evaluaciones;
- calificaciones;
- asistencia;
- registros anecdóticos;
- conducta.

## 8.15 Asistencia

Estados mínimos:

- Presente.
- Ausente.
- Llegada tardía.
- Salida anticipada.

Debe permitir:

- observaciones;
- justificaciones;
- consulta por fecha;
- consulta por estudiante;
- consulta por curso;
- rango de fechas;
- historial;
- impresión.

## 8.16 Registro anecdótico

- Estudiante.
- Fecha.
- Docente.
- Curso.
- Descripción.
- Categoría.
- Observaciones.
- Historial.

## 8.17 Conducta

- Estudiante.
- Fecha.
- Docente.
- Descripción.
- Intervención realizada.
- Observaciones.
- Historial.
- Reporte individual.

## 8.18 Informe grupal

Permitirá registrar eventos que afecten al grupo aunque no pueda
individualizarse a un estudiante.

Ejemplos:

- ausencia colectiva;
- retiro colectivo;
- comportamiento grupal;
- incidentes;
- eventos institucionales;
- acontecimientos sin responsable individual identificado.

Campos principales:

- fecha;
- institución;
- curso;
- materia opcional;
- docente;
- categoría;
- descripción;
- observaciones;
- estudiantes relacionados opcionalmente;
- evidencia cuando corresponda.

## 8.19 Dashboard

Debe mostrar información relevante según el usuario:

- instituciones;
- cursos;
- materias;
- estudiantes;
- tareas;
- evaluaciones;
- asistencia;
- accesos rápidos;
- pendientes.

## 8.20 Búsqueda y filtros

Por:

- nombre;
- cédula;
- curso;
- materia;
- fecha;
- rango de fechas;
- asistencia;
- conducta;
- actividad;
- evaluación.

## 8.21 Reportes

Como mínimo:

- académico individual;
- por curso;
- por materia;
- tareas;
- evaluaciones;
- calificaciones;
- asistencia diaria;
- asistencia por periodo;
- conducta;
- registro anecdótico;
- informe grupal;
- planificación anual;
- planificación diaria.

Debe permitir:

- vista previa;
- impresión;
- exportación/PDF cuando corresponda.

## 8.22 Consulta pública

Permitirá consultar información autorizada mediante identificación del
estudiante.

Podrá mostrar:

- tareas;
- evaluaciones;
- calificaciones;
- rendimiento;
- asistencia cuando esté habilitada.

Nunca deberá exponer:

- información administrativa;
- credenciales;
- notas internas;
- datos sensibles no autorizados.

## 8.23 Importación y exportación

- Importación de estudiantes.
- CSV.
- Excel cuando corresponda.
- Exportación de datos.
- Preparación para migraciones.

## 8.24 Respaldo y restauración

Debe contemplar información crítica de:

- usuarios;
- instituciones;
- docentes;
- cursos;
- materias;
- estudiantes;
- tareas;
- evaluaciones;
- calificaciones;
- asistencia;
- conducta;
- registros;
- currículo.

## 8.25 Auditoría

Registrar, cuando corresponda:

- usuario;
- acción;
- fecha/hora;
- entidad;
- registro afectado.

Especialmente para:

- calificaciones;
- asistencia;
- conducta;
- usuarios;
- permisos;
- eliminaciones.

---

# 9. Módulo curricular

## 9.1 Base curricular

Modelo conceptual:

Nivel
→ Curso
→ Materia
→ Competencia
→ Capacidad
→ Contenido
→ Indicador

La arquitectura deberá ser genérica.

## 9.2 Alcance curricular V1.0

La demostración oficial se limita a:

### Matemática Aplicada

- 1.º BTI
- 2.º BTI
- 3.º BTI

### Algorítmica

- 1.º BTI
- 2.º BTI
- 3.º BTI

La aplicación no deberá contener lógica codificada exclusivamente para
estas materias.

Nuevas disciplinas podrán incorporarse posteriormente.

## 9.3 Lectura/importación de mallas

V1.0 no promete interpretar cualquier malla curricular existente.

El flujo será:

Documento
→ extracción
→ propuesta estructurada
→ vista previa
→ revisión humana
→ corrección
→ confirmación
→ almacenamiento.

Debe poder distinguir:

- contenido proveniente de fuente curricular;
- contenido generado o sugerido por IA.

## 9.4 Planificación anual

Debe utilizar:

- malla curricular;
- materia;
- curso;
- capacidades;
- contenidos;
- indicadores;
- carga horaria;
- calendario académico;
- clases disponibles.

Permitirá:

- generar propuesta;
- revisar;
- modificar;
- reorganizar;
- aprobar;
- imprimir/exportar.

## 9.5 Planificación diaria

Debe contemplar:

- fecha;
- curso;
- materia;
- tema;
- duración;
- capacidad;
- indicadores;
- inicio;
- desarrollo;
- cierre;
- recursos;
- evidencias;
- evaluación.

Estados posibles:

- borrador;
- generado por IA;
- revisado;
- aprobado;
- desarrollado;
- parcialmente desarrollado;
- reprogramado.

## 9.6 Seguimiento curricular

Permitirá comparar:

Planificado vs. desarrollado.

Estados:

- desarrollado;
- parcialmente desarrollado;
- pendiente;
- reprogramado.

Debe poder calcular el avance curricular.

## 9.7 Asistente pedagógico con IA

Podrá sugerir:

- estrategias metodológicas;
- actividades;
- inicio;
- desarrollo;
- cierre;
- indicadores;
- recursos;
- ejercicios;
- instrumentos de evaluación.

Siempre deberá requerir validación docente.

---

# 10. Seguridad e integridad

La V1.0 deberá contemplar:

- autenticación backend;
- autorización backend;
- hashing seguro;
- cookies HttpOnly;
- protección de rutas;
- validación de datos;
- control de permisos;
- prevención de duplicados;
- integridad referencial;
- validación de puntajes;
- protección de consulta pública;
- manejo seguro de variables de entorno;
- claves API únicamente en backend.

---

# 11. Diseño y experiencia de usuario

Debe funcionar en:

- computadora;
- notebook;
- tablet;
- teléfono.

La interfaz debe priorizar:

- simplicidad;
- claridad;
- navegación rápida;
- formularios comprensibles;
- mensajes de error útiles;
- confirmación de operaciones destructivas;
- consistencia visual.

---

# 12. Pruebas

Deben contemplarse:

## Unitarias

- reglas de negocio;
- cálculos;
- calificaciones;
- puntos fuera de escala;
- validaciones.

## Integración

- API;
- PostgreSQL;
- permisos;
- persistencia.

## E2E

Como mínimo recorridos de:

- login;
- creación de institución;
- docente;
- curso;
- materia;
- asignación;
- estudiante;
- tarea;
- evaluación;
- calificación;
- asistencia;
- consulta;
- persistencia.

Ninguna prueba podrá documentarse como exitosa si no fue ejecutada.

---

# 13. Prototipo anterior

Existe una versión preliminar de EduGestor.

Se conserva localmente en:

legacy/

El prototipo sirve únicamente como:

- referencia funcional;
- referencia de interfaz;
- fuente de reglas de negocio reutilizables.

No constituye la arquitectura definitiva de V1.0.

No deberá modificarse directamente.

No deberá subirse a repositorios públicos si contiene datos reales.

---

# 14. Elementos que pueden reutilizarse del prototipo

Como referencia:

- tareas;
- evaluaciones;
- indicadores;
- puntos fuera de escala;
- calificaciones;
- asistencia;
- conducta;
- registros anecdóticos;
- impresión;
- consulta por cédula;
- importación de estudiantes;
- comportamiento visual.

Toda reutilización deberá adaptarse a la arquitectura V1.0.

---

# 15. Funcionalidades excluidas de V1.0

Quedan fuera:

- soporte universal para cualquier malla curricular;
- soporte validado para todas las materias;
- entrenamiento de un modelo propio de IA;
- corrección automática completa de evaluaciones mediante fotografía;
- aplicación móvil nativa;
- videollamadas;
- chat interno avanzado;
- LMS completo;
- analítica predictiva avanzada;
- integraciones externas no necesarias para la demostración.

Estas funcionalidades podrán evaluarse para V1.1 o versiones posteriores.

---

# 16. Prioridades

## P0 — Bloqueante

Sin estas funciones V1.0 no puede considerarse terminada:

- autenticación;
- roles;
- usuarios;
- docentes;
- instituciones;
- cursos;
- materias;
- asignaciones;
- estudiantes;
- tareas;
- evaluaciones;
- puntos fuera de escala;
- calificaciones;
- asistencia;
- persistencia;
- seguridad;
- respaldos;
- pruebas;
- documentación técnica mínima.

## P1 — Obligatoria para V1.0

- conducta;
- anecdóticos;
- informes grupales;
- reutilización de actividades;
- reportes;
- consulta pública;
- auditoría;
- base curricular;
- planificación anual;
- planificación diaria;
- asistente con IA;
- diseño responsive.

## P2 — Puede implementarse inicialmente de forma simplificada

- banco avanzado de actividades;
- dashboard avanzado;
- importaciones complejas;
- seguimiento curricular avanzado;
- automatizaciones secundarias.

---

# 17. Entregables

## Entregable 1 — Aplicación V1.0

- frontend;
- backend;
- base de datos;
- migraciones;
- pruebas;
- configuración;
- scripts;
- código fuente;
- versión demostrable.

## Entregable 2 — Manual de Usuario

Debe explicar:

- acceso;
- usuarios;
- cursos;
- materias;
- estudiantes;
- tareas;
- evaluaciones;
- calificaciones;
- asistencia;
- conducta;
- informes;
- consulta;
- currículo;
- planificación;
- IA.

Debe utilizar capturas reales de la versión definitiva.

## Entregable 3 — Manual Técnico

Debe incluir:

- arquitectura;
- tecnologías;
- instalación;
- configuración;
- variables de entorno;
- base de datos;
- API;
- seguridad;
- permisos;
- respaldos;
- pruebas;
- mantenimiento;
- despliegue.

## Entregable 4 — Documentación de tesis

Debe construirse con evidencia real del proyecto e incluir:

- introducción;
- problema;
- justificación;
- objetivos;
- antecedentes;
- estado del arte;
- marco teórico;
- marco tecnológico;
- metodología;
- requisitos;
- casos de uso;
- arquitectura;
- base de datos;
- diseño;
- implementación;
- IA;
- seguridad;
- pruebas;
- validación;
- resultados;
- discusión;
- conclusiones;
- recomendaciones;
- trabajo futuro;
- bibliografía;
- anexos.

---

# 18. Documentación permanente

Durante todo el desarrollo deberán mantenerse:

- PROJECT_MASTER.md
- PROJECT_CONTEXT.md
- REQUIREMENTS.md
- CHANGELOG.md
- ARCHITECTURE.md
- DECISIONS.md
- DATABASE.md
- API.md
- TESTS.md
- THESIS_NOTES.md
- USER_MANUAL_NOTES.md
- TECHNICAL_MANUAL_NOTES.md

Codex y Work deberán utilizar estos documentos como fuente de contexto.

---

# 19. Regla de documentación

Toda modificación importante deberá indicar:

1. Qué se modificó.
2. Por qué se modificó.
3. Qué archivos fueron afectados.
4. Qué decisión técnica fue tomada.
5. Qué pruebas se ejecutaron.
6. Qué resultado tuvieron.
7. Qué limitaciones permanecen.
8. Qué trabajo queda pendiente.

---

# 20. Definición de terminado

Una funcionalidad no se considera terminada únicamente porque el código
haya sido escrito.

Para marcarla como terminada deberá comprobarse:

- implementación;
- integración;
- persistencia;
- validaciones;
- permisos;
- pruebas;
- ausencia de errores críticos conocidos;
- interfaz revisada;
- documentación actualizada;
- evidencia registrada.

---

# 21. Congelamiento de alcance

Desde el inicio formal de V1.0, cualquier nueva propuesta deberá
clasificarse como:

### Corrección

Necesaria para que una funcionalidad existente funcione correctamente.

Puede entrar en V1.0.

### Seguridad o integridad

Necesaria para proteger datos o garantizar consistencia.

Puede entrar en V1.0.

### Nueva funcionalidad

No requerida por el alcance actual.

Debe pasar a V1.1 o versiones posteriores.

---

# 22. Hitos de desarrollo

## Hito 1 — 25/09/2026

Primera versión estructural funcional.

Debe demostrar, como mínimo:

Administrador inicia sesión
→ crea institución
→ crea docente
→ crea curso
→ crea materia
→ asigna Docente–Curso–Materia
→ docente inicia sesión
→ visualiza únicamente sus asignaciones
→ datos persisten en PostgreSQL.

## Objetivo interno V1.0

Finales de octubre de 2026.

## Periodo posterior

Noviembre de 2026 destinado principalmente a:

- validación;
- correcciones;
- pruebas con usuarios;
- documentación;
- resultados;
- cierre de tesis.

---

# 23. Estado inicial

Al comenzar el desarrollo formal:

- entorno Node.js disponible;
- npm disponible;
- Git disponible;
- Docker Desktop operativo;
- Docker Compose operativo;
- WSL 2 operativo;
- repositorio Git creado;
- prototipo V0 preservado;
- estructura documental creada.

El siguiente paso es formalizar RF/RNF y construir la arquitectura base
cliente-servidor.