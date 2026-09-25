# EduGestor V1.0 — Contexto de continuidad

## CHECKPOINT COMPLETADO — Núcleo institucional y académico backend del Hito 1

**Fecha:** 25/09/2026.

**Estado:** estable; sin commit Git.

### Implementado

- Módulo backend `academic` con flujo `controller → service → repository → Prisma`.
- CRUD lógico autorizado de `Institution`, sin rutas de borrado físico. La creación inicial se limita a cuenta técnica con motivo auditado, conforme al bootstrap excepcional de `DATABASE.md`; la gestión ordinaria exige `institution.read/manage` y scope de la institución.
- Creación transaccional de `User` estándar, `Teacher` y `TeacherInstitution`, además de consulta, actualización, activación, desactivación, reactivación y vinculación institucional.
- Desactivar `Teacher` revoca sus sesiones mediante el trigger existente; reactivar no restaura sesiones ni permisos.
- Creación, consulta y actualización válida de `AcademicYear`, incluida consulta del año actual y rechazo de dos años actuales simultáneos.
- Cursos con institución, año lectivo, grado, sección y turno normalizados; creación, listado filtrado por scope, consulta, actualización y activación lógica.
- Materias como catálogo institucional genérico; `curriculumDiscipline` sigue siendo opcional y no limita el catálogo a Matemática Aplicada o Algorítmica.
- Creación y consulta de `TeachingAssignment`, retiro/reactivación lógica, listado administrativo autorizado y `GET /api/v1/me/teaching-assignments`.
- Validación de docente, vínculo institucional, institución, curso y materia activos; coherencia institucional y ausencia de duplicados.
- El docente ve únicamente asignaciones propias vigentes. Un UUID ajeno o una asignación retirada no autoriza lectura docente.
- Auditoría atómica de mutaciones exitosas y auditoría externa de rechazos controlados, sin contraseñas, hashes, cookies ni tokens.
- Reintento acotado de transacciones serializables ante `P2034`, aplicado a operaciones académicas y delegación/revocación.
- No se modificó `schema.prisma`: los modelos y restricciones aprobados ya cubrían el checkpoint.

### API incorporada

- `/api/v1/institutions` y operaciones de activación.
- `/api/v1/institutions/:institutionId/teachers` y vínculo institucional.
- `/api/v1/institutions/:institutionId/academic-years` y consulta `current`.
- `/api/v1/courses`.
- `/api/v1/subjects`.
- `/api/v1/teaching-assignments`.
- `/api/v1/me/teaching-assignments`.

Todas las rutas son privadas. Las mutaciones requieren CSRF y el servicio evalúa permiso + scope; los controladores se limitan a validar contratos y transportar respuestas.

### Migraciones

- No se creó una migración nueva.
- Las cuatro migraciones existentes se aplicaron desde cero en `edugestor_academic_test`.
- `prisma migrate status` confirmó la base de desarrollo al día.

### Pruebas ejecutadas y resultado

- Integración completa contra PostgreSQL real: 9 archivos y 56/56 pruebas aprobadas.
- Los 17 casos obligatorios del checkpoint aprobaron, incluida creación docente transaccional, revocación de sesiones, duplicados, contextos incompatibles, entidades inactivas, aislamiento docente, retiro lógico y auditoría.
- `prisma validate`: aprobado.
- `prisma generate`: aprobado.
- `prisma migrate status`: 4 migraciones; esquema al día.
- `npm run typecheck`: aprobado en `shared`, `api` y `web`.
- `npm run build`: aprobado en los tres workspaces, incluido Vite.
- `npm test`: Shared 1, API 11 y Web 1 aprobadas; las 45 pruebas PostgreSQL se omiten por defecto y se ejecutaron por separado con `RUN_DATABASE_TESTS=1`.

### Errores encontrados y corregidos

- Vitest 5 no expuso `describe.sequential` en el formato asumido; se corrigió el arnés sin alterar el orden de los casos.
- Al ejecutar varias suites PostgreSQL en paralelo apareció un conflicto serializable `P2034`. Se añadió reintento máximo de tres intentos y la repetición desde base vacía aprobó 56/56 pruebas.
- No quedan errores conocidos dentro del checkpoint.

### Límites vigentes

- No existen rutas `DELETE`; los estados y vínculos se conservan históricamente.
- El contexto docente/curso/materia de una asignación no se reatribuye: se retira la asignación anterior y se crea otra.
- La creación de una institución no puede derivarse de un scope institucional inexistente; por norma se conserva como bootstrap técnico excepcional. Un administrador ordinario solo opera instituciones previamente incluidas en sus concesiones.
- No se implementaron estudiantes, tareas, asistencia, currículo, planificación, IA ni frontend funcional del Hito 1.

### Siguiente checkpoint exacto

**Frontend del Hito 1: login administrativo, gestión secuencial de institución/docente/curso/materia/asignación y página docente “Mis asignaciones”.**
