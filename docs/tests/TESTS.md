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

## Ejecución del 25/09/2026 — autorización jerárquica Hito 1

Base aislada: `edugestor_authorization_test`, creada vacía en PostgreSQL 17 de Docker y migrada con las cuatro migraciones versionadas.

| Verificación | Resultado |
|---|---|
| `npm run prisma:validate` | Aprobado |
| `npm run prisma:generate` | Aprobado |
| Migración desde base vacía | 4 migraciones aplicadas |
| `prisma migrate status` | Esquema al día |
| Integración con `RUN_DATABASE_TESTS=1` | 7 archivos, 36/36 pruebas aprobadas |
| `npm run typecheck` | Shared, API y Web aprobados |
| `npm run build` | Shared, API y Vite aprobados |
| `npm test` | Shared 1, API 9 y Web 1 aprobadas; 27 pruebas PostgreSQL omitidas por defecto |
| Catálogo idempotente | 2 ejecuciones, 13 permisos sincronizados sin duplicación |
| `docker compose config --quiet` | Aprobado |

Cobertura de autorización ejecutada contra PostgreSQL real:

1. Permiso y scope correctos: permitido.
2. Permiso correcto y scope incorrecto: rechazado.
3. Scope correcto y permiso incorrecto: rechazado.
4. Permiso de una concesión y scope de otra: rechazado.
5. Administrador institucional dentro de su institución: permitido.
6. Administrador limitado a curso fuera de ámbito: rechazado.
7. Delegación hacia scope menor con `parentGrantId`: permitida.
8. Delegación de permiso superior: rechazada y auditada.
9. Delegación de scope superior: rechazada y auditada.
10. Autoelevación: rechazada y auditada.
11. Intento de formar un ciclo alterando la procedencia: rechazado por inmutabilidad SQL.
12. Concesión revocada y descendientes: dejan de autorizar y quedan revocados cuando corresponde.
13. Usuario con varios roles: no acumula permiso y scope de concesiones distintas.
14. Docente A frente a asignación de Docente B: rechazado tanto en servicio como en API.
15. Auditoría de éxitos y rechazos: presente y sin contraseñas, hashes, cookies ni tokens.

También se verificaron el rechazo explícito de `RESOURCE_SET`, el middleware `requirePermission`, la resolución de recursos desde la base y la ruta de comprobación de asignación docente propia.

Durante la ejecución se corrigieron dos errores antes de la corrida final: un alias SQL reservado y la revalidación innecesaria del padre al actualizar únicamente `revokedAt`. La segunda condición quedó corregida mediante una migración adicional y volvió a probarse desde base vacía.

## Ejecución del 25/09/2026 — núcleo institucional y académico Hito 1

Base aislada: `edugestor_academic_test`, creada vacía en PostgreSQL 17 de Docker y migrada con las cuatro migraciones versionadas existentes.

| Verificación | Resultado |
|---|---|
| `npm run prisma:validate` | Aprobado |
| `npm run prisma:generate` | Aprobado |
| Migración desde base vacía | 4 migraciones aplicadas |
| `prisma migrate status` | Base de desarrollo al día |
| Integración con `RUN_DATABASE_TESTS=1` | 9 archivos, 56/56 pruebas aprobadas |
| `npm run typecheck` | Shared, API y Web aprobados |
| `npm run build` | Shared, API y Vite aprobados |
| `npm test` | Shared 1, API 11 y Web 1 aprobadas; 45 integraciones omitidas por defecto |

Casos nuevos ejecutados contra PostgreSQL real:

1. Creación institucional mediante bootstrap técnico auditado y establecimiento posterior de scope explícito.
2. Rechazo de creación ordinaria y consulta fuera del scope institucional.
3. Creación transaccional de cuenta, docente y vínculo institucional.
4. Desactivación docente con revocación de sesiones y reactivación sin restaurarlas.
5. Creación y consulta del año lectivo actual.
6. Rechazo de dos años actuales en una institución.
7. Creación de curso con contexto y valores normalizados.
8. Rechazo de curso duplicado por combinación normalizada.
9. Creación de materia genérica sin disciplina curricular obligatoria.
10. Creación de dos asignaciones docentes válidas.
11. Rechazo de terna duplicada.
12. Rechazo separado de docente, curso y materia pertenecientes a otra institución.
13. Rechazo de curso o materia inactivos al crear una asignación.
14. Consulta docente propia mediante servicio y `GET /api/v1/me/teaching-assignments`.
15. Rechazo de lectura por UUID de una asignación ajena.
16. Retiro lógico que conserva la fila y elimina el acceso docente operativo.
17. Auditoría de éxitos y rechazos sin contraseñas, hashes, cookies ni tokens.

Adicionalmente, una prueba HTTP verifica rechazo sin sesión, rechazo de mutación sin CSRF y creación autorizada atravesando router, controlador, servicio, repositorio y Prisma.

La ejecución paralela de integración expuso un conflicto serializable `P2034` en delegación. Se incorporó un reintento acotado de hasta tres intentos en las transacciones de autorización y académicas. La corrida final desde cero aprobó sin fallos.

## Ejecución del 25/09/2026 — frontend del Hito 1

| Verificación | Resultado |
|---|---|
| React Testing Library/Vitest | 1 archivo, 8/8 pruebas aprobadas |
| Build Vite de producción | Aprobado; 103 módulos transformados |
| Playwright sobre Chrome local | 1/1 recorrido aprobado |
| `npm run typecheck` | Shared, API y Web aprobados |
| `npm run build` | Shared, API y Web aprobados |
| `npm test` | Shared 1, API 11 y Web 8 aprobadas; 45 integraciones PostgreSQL omitidas por defecto |

La cobertura frontend verifica:

1. Redirección de una ruta privada cuando no existe sesión.
2. Login correcto, error uniforme y transporte con `credentials: "include"`.
3. Restauración de sesión al recargar.
4. Controles administrativos presentes o ausentes según la respuesta de autorización.
5. Formularios de año lectivo y curso.
6. Obtención de CSRF, encabezado `x-csrf-token` y ausencia de escritura en Web Storage.
7. Mensajes de interfaz específicos para `403`, `409` y `422`.
8. Estado vacío docente y ausencia de navegación/controles administrativos.

El E2E construye el frontend, lo sirve con un servidor estático efímero y simula únicamente las respuestas de la API con datos ficticios. Recorre login administrador → institución → docente → año/curso → materia → asignación → logout → login docente → Mis asignaciones → acceso ajeno `403`. Las credenciales de prueba no se persisten y no corresponden a usuarios reales.

La integración PostgreSQL de 56 casos no se repitió porque este checkpoint no altera backend, Prisma ni migraciones. Su resultado estable queda registrado en la sección anterior.
