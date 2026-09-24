# Bootstrap técnico

## Estructura

- `apps/web`: frontend React/Vite/TypeScript/Tailwind CSS.
- `apps/api`: API Node.js/Express/TypeScript.
- `packages/shared`: contratos TypeScript y esquemas Zod compartidos.
- `apps/api/prisma/schema.prisma`: persistencia aprobada para el Hito 1.
- `apps/api/prisma/migrations/20260924160000_initial_hito1`: primera migración versionada.
- `apps/api/src/modules`: módulos iniciales de acceso a usuarios y auditoría.
- `apps/api/src/middleware`: request ID, manejo de errores y rutas inexistentes.

## Configuración local

1. Copiar `.env.example` a `.env`.
2. Ejecutar `npm install`.
3. Iniciar PostgreSQL con `docker compose up -d postgres`.
4. Aplicar migraciones con `npm run prisma:migrate:deploy -w @edugestor/api`.
5. Ejecutar `npm run dev`.

El endpoint `GET /health` devuelve `200` cuando PostgreSQL responde y `503` cuando la base de datos no está disponible.

## Verificación

```bash
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:deploy -w @edugestor/api
npm run typecheck
npm test
npm run build
docker compose config
```

Para validar todo el entorno contenedorizado:

```bash
docker compose up -d --build
docker compose ps
```

La imagen API ejecuta `prisma migrate deploy` antes de iniciar Express. El comando es idempotente y permite levantar Compose sobre un volumen PostgreSQL vacío o ya migrado.

## Configuración del backend

- `DATABASE_URL`: conexión PostgreSQL obligatoria.
- `API_PORT`: puerto HTTP; valor predeterminado `3000`.
- `CORS_ALLOWED_ORIGINS`: lista separada por comas; no usa comodín con credenciales.
- `LOG_LEVEL`: nivel Pino. Contraseñas, hashes, tokens, cookies y encabezados de autorización se redactan.

La API usa Prisma Client como acceso único a PostgreSQL. `GET /health` ejecuta `SELECT 1` y responde `503` si la base no está disponible. Cada respuesta incorpora `x-request-id`; un UUID válido suministrado por el cliente se conserva para correlación.

## Bootstrap de la cuenta técnica

El comando no contiene credenciales predeterminadas. Antes de ejecutarlo se deben definir en el entorno:

```powershell
$env:BOOTSTRAP_ROOT_LOGIN='login-elegido'
$env:BOOTSTRAP_ROOT_PASSWORD='secreto-largo-generado-fuera-del-repositorio'
$env:BOOTSTRAP_ROOT_REASON='motivo documentado'
npm run bootstrap:root -w @edugestor/api
```

La contraseña se almacena con `scrypt` y salt aleatoria. La creación de `User` técnico y `AuditLog` ocurre en una sola transacción. Repetir el comando con el mismo login no cambia la contraseña ni duplica la cuenta o el evento; si el login ya pertenece a una cuenta ordinaria, el comando falla.

## Restricciones fuera de Prisma

La migración SQL añade las restricciones que el DSL de Prisma no representa: índices únicos parciales, `CHECK`, FK compuestas, triggers de coherencia de ámbitos/delegación y protección append-only de `AuditLog`. `RESOURCE_SET` se rechaza expresamente mientras `ScopeResource` permanezca fuera del checkpoint aprobado.
