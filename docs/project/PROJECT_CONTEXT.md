# EduGestor V1.0 — Contexto de continuidad

## CHECKPOINT COMPLETADO — Persistencia y fundaciones backend del Hito 1

**Fecha:** 24/09/2026.
**Estado:** estable; sin commit Git.

### Implementado

- Esquema Prisma PostgreSQL para `User`, `AuthSession`, `Role`, `Permission`, `AccessScope`, `ScopeCourse`, `RoleAssignment`, `RoleAssignmentPermission`, `Institution`, `AcademicYear`, `Teacher`, `TeacherInstitution`, `Course`, `Subject`, `TeachingAssignment` y `AuditLog`.
- UUID, relaciones restrictivas, claves únicas, índices, enums, activación, marcas históricas y control de versión aprobados en `DATABASE.md`.
- Restricciones SQL no expresables por Prisma: unicidades parciales, fechas de año lectivo, coherencia institucional mediante FK compuestas, validación de ámbitos de curso, bloqueo temporal de `RESOURCE_SET`, contexto de delegación y `AuditLog` append-only.
- Prisma Client y una primera migración versionada.
- Backend modular con configuración Zod, acceso Prisma compartido, repositorios base/usuarios/auditoría, errores uniformes, request ID, Helmet, CORS por lista de orígenes y logging estructurado con redacción de secretos.
- Hashing de contraseña con `scrypt`, salt aleatoria y comparación en tiempo constante, requerido por el bootstrap.
- Comando idempotente `npm run bootstrap:root -w @edugestor/api`. Recibe login, contraseña y motivo sólo mediante variables de entorno; no contiene credenciales fijas. La creación de la cuenta y su auditoría son atómicas.

### Migración creada

- `apps/api/prisma/migrations/20260924160000_initial_hito1/migration.sql`
- Aplicada desde una base vacía llamada `edugestor_hito1_20260924`.
- Resultado: una migración aplicada y esquema al día; 16 tablas del modelo más `_prisma_migrations`.

### Pruebas ejecutadas y resultado

- `prisma validate`: aprobado.
- `prisma generate`: aprobado.
- `prisma migrate deploy` desde PostgreSQL vacío: aprobado.
- Pruebas de persistencia reales: 2 aprobadas; verificaron contexto válido, cruces institucionales rechazados, `CHECK`, unicidades parciales, `RESOURCE_SET` diferido y auditoría inmutable.
- Pruebas API completas con integración habilitada: 7/7 aprobadas.
- `npm run typecheck`: aprobado en `shared`, `api` y `web`.
- `npm run build`: aprobado en los tres workspaces; build Vite incluido.
- `npm test`: aprobado; 7 pruebas ordinarias aprobadas y 2 de integración omitidas por defecto, ejecutadas por separado contra PostgreSQL.
- Bootstrap raíz ejecutado dos veces: primera ejecución creó una cuenta; segunda ejecución la reutilizó. Conteo final: 1 cuenta técnica y 1 evento de bootstrap.
- Backend compilado: `GET /health` devolvió HTTP 200, `{"status":"ok","database":"available"}`, request ID conservado, CORS correcto y cabecera Helmet `nosniff`.
- Docker Compose: imagen API reconstruida, PostgreSQL saludable y API saludable.

### Errores pendientes

- Ninguno conocido dentro del alcance de este checkpoint.
- `ScopeResource` y el uso efectivo de `RESOURCE_SET` permanecen deliberadamente diferidos hasta el hito que incorpore todos sus destinos tipados.
- No se implementaron todavía endpoints de autenticación, sesiones opacas, cookies, autorización, CRUD administrativo ni módulos académicos.

### Siguiente tarea exacta

Implementar el siguiente checkpoint de fundaciones de autenticación: creación y revocación de sesiones opacas, utilidades de cookie segura, endpoints de login/logout y middleware de sesión, con pruebas de credenciales inválidas, expiración, revocación y bloqueo de docentes desactivados. No iniciar todavía CRUD administrativo ni ampliar el schema fuera del Hito 1 aprobado.
