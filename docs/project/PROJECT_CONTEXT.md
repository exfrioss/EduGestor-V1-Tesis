# EduGestor V1.0 — Contexto de continuidad

## CHECKPOINT COMPLETADO — Motor de autorización jerárquica del Hito 1

**Fecha:** 25/09/2026.

**Estado:** estable; sin commit Git.

### Implementado

- Denegación por defecto y evaluación de permisos explícitos mediante una única concesión vigente; un permiso y un ámbito de concesiones distintas nunca se combinan.
- Ámbitos `INSTITUTION` y `COURSE_SET`, con contención institucional y por subconjunto de cursos. `RESOURCE_SET` se rechaza explícitamente en servicio, API y PostgreSQL.
- Evaluación completa de `parentGrantId`: permiso coincidente, delegante correcto, ámbito igual o menor, usuarios y asignaciones activos, ausencia de revocación y raíz creada por cuenta técnica activa.
- Middleware exportado `requirePermission` y resolución del ámbito real de institución, vínculo docente-institución, curso, materia y `TeachingAssignment` desde PostgreSQL.
- Delegación D-01 con rechazo de autoasignación, permiso o ámbito superior, destino inválido y procedencia mutable.
- Revocación transaccional de la concesión y sus permisos descendientes; una asignación descendiente queda revocada cuando pierde todos sus permisos activos.
- Invariantes SQL para contención, raíces técnicas, cadena sin ciclos, inmutabilidad de procedencia, inmutabilidad de ámbitos usados y contexto inmutable de asignaciones con permisos.
- Catálogo idempotente de 13 permisos técnicos, limitado a instituciones, docentes, cursos, materias, asignaciones docentes, delegación/revocación y auditoría.
- Servicio y ruta de comprobación que permiten al docente acceder únicamente a sus `TeachingAssignment` vigentes.
- API mínima bajo `/api/v1/authorization` para comprobar permisos, comprobar asignación docente propia, delegar y revocar. Las mutaciones exigen sesión y CSRF.
- Auditoría de concesiones y revocaciones exitosas o denegadas, sin credenciales, hashes, cookies ni tokens.

### Migraciones creadas

- `apps/api/prisma/migrations/20260925010000_authorization_invariants/migration.sql`.
- `apps/api/prisma/migrations/20260925011000_allow_permission_revocation/migration.sql`.
- Las cuatro migraciones acumuladas se aplicaron desde cero en `edugestor_authorization_test`; la base de desarrollo `edugestor` también quedó al día.

### Pruebas ejecutadas y resultado

- PostgreSQL real desde base vacía: 7 archivos y 36/36 pruebas aprobadas.
- Los 15 casos obligatorios de autorización aprobaron, además del rechazo explícito de `RESOURCE_SET` y las rutas HTTP con `requirePermission`/aislamiento docente.
- `prisma validate`: aprobado.
- `prisma generate`: aprobado.
- `prisma migrate status`: 4 migraciones; esquema al día.
- `npm run typecheck`: aprobado en `shared`, `api` y `web`.
- `npm run build`: aprobado en los tres workspaces, incluido Vite.
- `npm test`: Shared 1, API 9 y Web 1 aprobadas; las 27 pruebas PostgreSQL se omiten por defecto y se ejecutaron por separado con `RUN_DATABASE_TESTS=1`.
- `bootstrap:authorization-catalog`: dos ejecuciones consecutivas aprobadas; 13 permisos sin duplicación.
- `docker compose config --quiet`: aprobado.

### Errores encontrados y corregidos

- El primer intento de la migración de autorización falló por usar una palabra reservada de PostgreSQL como alias; se corrigió el SQL y la migración se aplicó completa.
- La primera integración reveló que el trigger de procedencia revalidaba el padre durante una revocación en cascada. La migración correctiva permite cambiar únicamente el estado y conserva inmutables la asignación, permiso, padre y delegante.
- No quedan errores conocidos dentro del checkpoint.

### Límites vigentes

- Los roles son etiquetas de asignación y no conceden permisos implícitos; los permisos efectivos siempre provienen de `RoleAssignmentPermission`.
- Las concesiones raíz requieren una cuenta técnica activa y no se exponen mediante la API ordinaria.
- No se implementaron aún CRUD de instituciones/docentes/contexto académico/cursos/materias/asignaciones ni pantallas administrativas.
- `RESOURCE_SET` permanece fuera del Hito 1.

### Siguiente checkpoint exacto

**Instituciones + docentes + contexto académico + cursos + materias + TeachingAssignment.**
