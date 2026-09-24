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
- `SESSION_TTL_HOURS`: expiración absoluta; valor predeterminado `8`, máximo `168`.
- `SESSION_LAST_SEEN_INTERVAL_SECONDS`: frecuencia mínima para persistir actividad; predeterminado `300`.
- `AUTH_COOKIE_NAME`: nombre de cookie HttpOnly; predeterminado `edugestor_session`.
- `CSRF_COOKIE_NAME`: nombre de cookie para doble envío; predeterminado `edugestor_csrf`.
- `LOGIN_RATE_LIMIT_WINDOW_MINUTES`: ventana del limitador de login; predeterminado `15`.
- `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`: intentos fallidos por IP y ventana; predeterminado `5`.

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

## Autenticación y sesiones

Las contraseñas usan `scrypt` con `N=16384`, `r=8`, `p=1`, clave derivada de 64 bytes y sal aleatoria de 16 bytes. El formato almacenado contiene algoritmo, parámetros, sal y resultado codificados; no es cifrado reversible.

Al iniciar sesión se genera un token opaco mediante `randomBytes(32)`. El navegador recibe el token únicamente en cookie HttpOnly y la base almacena su hash SHA-256. No se utiliza JWT como sesión principal. La cookie usa `SameSite=Lax`, se limita a `Path=/`, tiene la misma expiración absoluta que la fila y agrega `Secure` cuando `NODE_ENV=production`.

La duración predeterminada es de 8 horas. `lastSeenAt` se actualiza como máximo una vez por intervalo configurado y no produce expiración deslizante. Una sesión expirada o revocada, un usuario inactivo o un docente inactivo se rechaza de forma uniforme. Los triggers de la segunda migración revocan todas las sesiones cuando cambia `isActive` a falso en `User` o `Teacher`.

Flujo CSRF para una operación mutable autenticada:

1. Iniciar sesión.
2. Consultar `GET /api/v1/auth/csrf`.
3. Conservar la cookie CSRF mediante el navegador y enviar el valor recibido en `X-CSRF-Token`.
4. Enviar la operación mutable con ambas cookies. El backend compara cookie y encabezado en tiempo constante.

El token CSRF no es una credencial de sesión. Puede ser leído por el frontend para construir el encabezado; el token opaco de sesión no puede ser leído por JavaScript.

El rate limiter de login usa memoria local y omite del cómputo definitivo los intentos exitosos. Esto es reproducible para la instancia única de Compose. Antes de ejecutar múltiples réplicas debe sustituirse por un store compartido y atómico.

### Pruebas PostgreSQL de autenticación

Usar siempre una base desechable ya migrada:

```powershell
$env:DATABASE_URL='postgresql://usuario:clave@localhost:5432/base_auth_desechable?schema=public'
$env:RUN_DATABASE_TESTS='1'
npm run test -w @edugestor/api
```

La suite crea cuentas y auditoría append-only; por diseño no intenta limpiar esos registros al finalizar. No debe apuntarse a una base con datos reales.
