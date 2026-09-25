# EduGestor V1.0 — Contexto de continuidad

## CHECKPOINT COMPLETADO — Frontend del Hito 1

**Fecha:** 25/09/2026.

**Estado:** estable; sin commit Git.

### Implementado

- Aplicación React funcional con React Router y TanStack Query sobre las APIs existentes; no se añadieron endpoints ni reglas de dominio.
- Login, restauración de sesión, logout, cookie de sesión administrada por el navegador, CSRF de doble envío y cliente HTTP con `credentials: "include"`.
- El token CSRF se conserva únicamente en memoria. No se escriben token, cookie ni credenciales en `localStorage` o `sessionStorage`.
- Manejo uniforme de `401`, `403`, `409` y `422`; un `401` operativo invalida el estado local de sesión.
- Rutas privadas, redirección inicial basada en capacidades observables del backend, `PermissionGate`, `AdminLayout`, `TeacherLayout`, `ForbiddenPage` y `NotFoundPage`.
- Flujo administrativo responsive y secuencial: Institución → Docentes/cuenta → Año lectivo/curso → Materias → TeachingAssignment.
- Listado, alta, consulta en contexto, edición y cambios de estado conforme a las rutas ya disponibles. Las operaciones sensibles piden confirmación.
- Área docente “Mis asignaciones” con institución, año lectivo, grado, sección, turno y materia. Una cuenta solo docente no recibe navegación ni controles administrativos.
- Estados de carga, vacío, éxito y error en todas las etapas principales.
- Escenario Playwright reproducible con datos ficticios e interceptación de API; no inserta datos ni secretos en PostgreSQL.

### Rutas de pantalla

- `/login`
- `/admin/institutions`
- `/admin/institutions/:institutionId/teachers`
- `/admin/institutions/:institutionId/academic`
- `/admin/institutions/:institutionId/subjects`
- `/admin/institutions/:institutionId/assignments`
- `/teacher/assignments`
- `/forbidden` y fallback `404`

### API y persistencia

- No se modificó la API backend, el schema Prisma ni las migraciones.
- El frontend consume exclusivamente autenticación, comprobación de autorización y módulos académicos documentados en `API.md`.
- La creación ordinaria de instituciones continúa sin inferirse desde un scope inexistente; solo se presenta a cuentas `TECHNICAL`, conforme al backend aprobado.

### Pruebas ejecutadas y resultado

- React Testing Library/Vitest: 8/8 pruebas aprobadas.
- Playwright con Chrome local y datos ficticios: 1/1 recorrido completo aprobado.
- Build Vite de producción: aprobado.
- Validación integral final: `npm run typecheck`, `npm run build` y `npm test` aprobados en los tres workspaces.
- La integración PostgreSQL backend no se repitió en este checkpoint exclusivamente frontend; el checkpoint backend estable previo conserva 56/56 pruebas PostgreSQL aprobadas.

### Errores encontrados y corregidos

- Se corrigió el aislamiento de DOM entre pruebas de React mediante `cleanup` global.
- El navegador Playwright administrado no estaba instalado; se configuró el Chrome local disponible.
- Vite dev intentó optimizar dependencias fuera del ámbito permitido; el E2E ahora construye la aplicación y la sirve desde un servidor estático controlado por el propio test.
- Se corrigió la simulación del acceso a UUID ajeno para que reproduzca el `403` real.

### Límites vigentes

- No existe en la API un endpoint agregado de capacidades. La UI deriva la entrada administrativa del listado autorizado de instituciones y consulta controles concretos mediante `/authorization/check`; el backend sigue siendo la única autoridad.
- El E2E es una demostración frontend determinista con API simulada. La cobertura real PostgreSQL vive en las pruebas de integración backend del checkpoint anterior.
- Las credenciales `admin.demo` y `docente.demo` son exclusivamente ficticias dentro del E2E. No son cuentas creadas en una base real.
- No se implementaron estudiantes, tareas, asistencia, currículo, planificación ni IA.

### Siguiente checkpoint exacto

**Cierre verificable del Hito 1: preparar datos de demostración no productivos mediante un mecanismo backend aprobado, ejecutar el recorrido navegador contra PostgreSQL real y realizar revisión de accesibilidad/UX sin ampliar el dominio.**
