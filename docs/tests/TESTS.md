# Pruebas técnicas y de persistencia

La infraestructura configura:

- Vitest para los tres workspaces.
- React Testing Library para el frontend.
- Supertest para la API.
- Playwright para futuras pruebas E2E y una comprobación mínima del bootstrap.

Las pruebas ordinarias verifican el contrato compartido de salud, la respuesta disponible/degradada de `GET /health`, request ID, errores uniformes, cabeceras Helmet, configuración CORS, hashing de contraseña y el renderizado inicial del frontend.

Comando principal:

```bash
npm test
```

## Ejecución del 22/09/2026

- Instalación npm: 337 paquetes auditados, 0 vulnerabilidades tras actualizar el toolchain.
- TypeScript: los tres workspaces compilaron sin errores.
- Vitest: 3 archivos y 4 pruebas aprobadas.
- Frontend: build de Vite aprobado.
- Prisma: generación del cliente y validación del esquema aprobadas.
- Docker Compose: configuración válida; `web`, `api` y `postgres` iniciados.
- PostgreSQL: `pg_isready` y `SELECT 1` aprobados; 0 tablas en el esquema `public`.
- `GET /health`: HTTP 200 con estado `ok` y base de datos `available`.
- Frontend contenedorizado: HTTP 200.

Playwright queda configurado para los recorridos E2E posteriores. Su prueba de navegador no se ejecutó en este bootstrap porque no se instalaron binarios de navegador como parte de esta tarea.

## Ejecución del 24/09/2026 — checkpoint de persistencia Hito 1

Base aislada: `edugestor_hito1_20260924`, creada vacía en PostgreSQL 17 de Docker.

| Verificación | Comando / mecanismo | Resultado |
|---|---|---|
| Schema Prisma | `npm run prisma:validate -w @edugestor/api` | Aprobado |
| Prisma Client | `npm run prisma:generate -w @edugestor/api` | Aprobado |
| Migración vacía | `npm run prisma:migrate:deploy -w @edugestor/api` | 1 migración aplicada |
| Estado migración | `prisma migrate status` | Esquema al día |
| Integración PostgreSQL | `RUN_DATABASE_TESTS=1 npm test -w @edugestor/api` | 4 archivos, 7 pruebas aprobadas |
| Suite ordinaria | `npm test` | Shared 1, API 5 y Web 1 aprobadas; las 2 de DB se omiten por defecto |
| TypeScript | `npm run typecheck` | 3 workspaces aprobados |
| Builds | `npm run build` | Shared, API y Vite aprobados |
| Bootstrap idempotente | dos ejecuciones de `bootstrap:root` | crea una vez; segunda ejecución no duplica |
| API compilada | `GET /health` en puerto de prueba | HTTP 200; DB disponible; request ID, CORS y Helmet correctos |
| Docker Compose | rebuild de `api`, `compose ps`, `/health` | API y PostgreSQL saludables |

Las pruebas de integración cubren creación coherente de institución/año/curso/materia/docente/asignación; rechazo de cruces entre instituciones; año lectivo inválido; segundo año actual; duplicación de concesión activa; ámbito de cursos inconsistente; bloqueo de `RESOURCE_SET`; e inmutabilidad de `AuditLog`.

Para ejecutar las pruebas de DB debe usarse una base desechable ya migrada y definir explícitamente:

```powershell
$env:RUN_DATABASE_TESTS='1'
$env:DATABASE_URL='postgresql://usuario:clave@localhost:5432/base_desechable?schema=public'
npm run test -w @edugestor/api
```

No se ejecutó Playwright en este checkpoint; no forma parte de la persistencia ni de las fundaciones backend solicitadas.

## Ejecución del 24/09/2026 — autenticación y sesiones Hito 1

Base final aislada: `edugestor_auth_race_20260924`, creada vacía en PostgreSQL 17 y migrada con las dos migraciones versionadas. La corrida final incluye el refuerzo serializable contra carreras entre login y desactivación.

| Verificación | Resultado |
|---|---|
| `npm run prisma:validate -w @edugestor/api` | Aprobado |
| `npm run prisma:generate -w @edugestor/api` | Aprobado |
| Migración desde base vacía | 2 migraciones aplicadas |
| Integración con `RUN_DATABASE_TESTS=1` | 6 archivos, 20/20 pruebas aprobadas |
| `npm run typecheck` | Shared, API y Web aprobados |
| `npm run build` | Shared, API y Vite aprobados |
| `npm test` | Shared 1, API 9 y Web 1 aprobadas; 11 integraciones DB omitidas por defecto |

Cobertura de autenticación ejecutada contra PostgreSQL real:

- Login válido, contraseña incorrecta, usuario inexistente y cuenta desactivada con respuesta uniforme.
- Emisión de cookie HttpOnly/SameSite y comprobación unitaria de `Secure` en producción.
- Token opaco aleatorio y persistencia exclusiva de su hash.
- Sesión válida, expirada, revocada y actualización de `lastSeenAt` sin modificar la expiración absoluta.
- Logout con revocación y limpieza de cookies.
- Rechazo de recurso privado sin sesión y de logout autenticado sin CSRF.
- Revocación de todas las sesiones por desactivación directa de `User` y `Teacher`; rechazo de login docente posterior.
- Rate limiting de login con secuencia `401, 401, 429` para el límite de prueba.
- Inspección de respuestas, auditoría y logs para verificar ausencia de contraseña, `passwordHash` y token opaco.

El primer intento final de `prisma generate` encontró `EPERM` porque un proceso Node antiguo del propio repositorio mantenía cargado el DLL de Prisma. Se identificó ese proceso por el módulo abierto, se detuvo únicamente ese PID y la repetición aprobó. No queda un defecto de código asociado.
