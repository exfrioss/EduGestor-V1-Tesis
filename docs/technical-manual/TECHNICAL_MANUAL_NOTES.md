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

## Autorización jerárquica

El motor vive en `apps/api/src/modules/authorization`. `AuthorizationService` busca concesiones activas del usuario para un permiso concreto y evalúa cada concesión de forma independiente. Esto impide combinar el permiso de un rol con el scope de otro. La decisión es negativa si no existe una concesión completa y vigente.

La cadena de delegación se recorre por `parentGrantId` hasta una raíz. Cada tramo exige el mismo permiso, que el padre pertenezca al delegante, que el scope padre contenga al hijo y que permisos, asignaciones y usuarios sigan activos. La raíz debe proceder de una cuenta `TECHNICAL` activa. La revocación o inactividad de cualquier ancestro invalida todos los descendientes.

`INSTITUTION` contiene todos los recursos de una institución. `COURSE_SET` contiene únicamente los cursos listados y recursos que resuelven a esos cursos. Un conjunto de cursos solo contiene a otro si es superconjunto dentro de la misma institución. `RESOURCE_SET` se rechaza expresamente y no debe habilitarse hasta un checkpoint normativo posterior.

La migración `20260925010000_authorization_invariants` agrega funciones y triggers para la contención de ámbitos, raíces técnicas, procedencia inmutable, conjuntos de cursos inmutables una vez concedidos y contexto inmutable de la asignación. La migración `20260925011000_allow_permission_revocation` permite actualizar el estado de revocación sin permitir alterar la procedencia.

### Catálogo técnico

Sincronizar el catálogo después de aplicar migraciones:

```bash
npm run bootstrap:authorization-catalog -w @edugestor/api
```

El comando es idempotente y no asigna permisos ni crea concesiones raíz. Estas últimas siguen siendo una operación técnica excepcional, auditada y fuera de la API ordinaria.

### Delegación y revocación

Las operaciones mutables requieren cookie de sesión y doble envío CSRF. `DelegationService` usa transacciones serializables, valida el permiso administrativo y busca un padre efectivo para cada permiso delegado. El éxito se audita en la misma transacción; un rechazo controlado se audita fuera de la transacción revertida.

Al revocar se recorren las relaciones padre-hijo, se revocan los permisos descendientes y se revoca cada asignación descendiente que ya no conserva permisos activos. `AuditLog` registra actor, resultado, ámbito y códigos de permiso, pero nunca contraseña, hash, cookie o token.

### Pruebas PostgreSQL de autorización

Usar una base desechable vacía, aplicar todas las migraciones y ejecutar:

```powershell
$env:DATABASE_URL='postgresql://usuario:clave@localhost:5432/base_autorizacion_desechable?schema=public'
$env:RUN_DATABASE_TESTS='1'
npm run test -w @edugestor/api
```

La suite no limpia `AuditLog`, que es append-only; nunca debe apuntarse a datos reales.

## Núcleo institucional y académico

El módulo se encuentra en `apps/api/src/modules/academic` y mantiene la secuencia:

```text
academic.router → AcademicController → AcademicService → AcademicRepository → Prisma/PostgreSQL
```

El router aplica autenticación y CSRF. El controlador valida contratos Zod y construye el contexto del actor. El servicio decide autorización, reglas de estado, coherencia y auditoría. El repositorio concentra consultas y escrituras Prisma. Los controladores no deciden permisos.

### Instituciones

La administración ordinaria requiere `institution.read` o `institution.manage` sobre la propia institución. Crear la primera fila no puede depender de un `AccessScope` que todavía no puede existir por su FK; por ello `POST /api/v1/institutions` conserva la excepción normativa de bootstrap: cuenta `TECHNICAL`, motivo obligatorio y auditoría. No concede automáticamente scope, rol ni permiso.

### Docentes

La creación con cuenta nueva calcula el hash `scrypt` antes de abrir la transacción y persiste `User`, `Teacher`, `TeacherInstitution` y `AuditLog` dentro de una única transacción serializable. También puede vincular una cuenta estándar existente que esté activa y no tenga perfil docente.

Desactivar `Teacher` actualiza estado, fecha y actor. El trigger PostgreSQL existente revoca todas sus `AuthSession` activas. Reactivar no modifica `User`, no crea sesiones y no restaura concesiones revocadas.

`TeacherInstitution` nunca se elimina: `unlink` establece `endedAt` y `link` rehabilita la misma fila.

### Contexto académico

- `AcademicYear` valida fechas y deja a PostgreSQL imponer etiqueta única y un único año actual por institución.
- `Course` normaliza grado, sección y turno con colapso de espacios, minúsculas y eliminación de diacríticos antes de la restricción única.
- Cambiar el año de un curso se rechaza si ya existe historia de `TeachingAssignment`.
- `Subject` normaliza el nombre comparable. `curriculumDiscipline` es metadato opcional y no restringe el catálogo genérico.
- No existen operaciones de borrado físico.

### TeachingAssignment

La creación comprueba en la misma transacción:

- permiso `teaching-assignment.manage` sobre el curso;
- institución activa;
- docente y cuenta activos;
- `TeacherInstitution` vigente;
- curso y materia activos;
- pertenencia de curso y materia a la institución;
- unicidad de docente + curso + materia.

El contexto no se reasigna. Para cambiar docente, curso o materia se retira la asignación anterior y se crea una nueva. `retire` establece `endedAt`; `reactivate` solo lo limpia si todas las dependencias vuelven a ser válidas.

`GET /api/v1/me/teaching-assignments` deriva el docente desde la sesión y consulta por su `teacherId`; no acepta un docente aportado por el cliente. La lectura individual propia exige que la asignación siga vigente. Las lecturas administrativas se evalúan por permiso y scope de forma separada.

### Auditoría y concurrencia

Cada mutación exitosa y su `AuditLog` se guardan atómicamente. Los rechazos controlados se auditan después del rollback. Las proyecciones de auditoría excluyen contraseña, hash y tokens.

Las transacciones serializables reintentan hasta tres veces el error Prisma `P2034`. Agotar los intentos conserva el error y no confirma escrituras parciales.

### Pruebas PostgreSQL

Usar una base desechable vacía:

```powershell
$env:DATABASE_URL='postgresql://usuario:clave@localhost:5432/base_academica_desechable?schema=public'
npm run prisma:migrate:deploy -w @edugestor/api
$env:RUN_DATABASE_TESTS='1'
npm run test -w @edugestor/api
```

La suite crea auditoría append-only y no debe ejecutarse contra datos reales.

## Frontend del Hito 1

La aplicación se organiza en `apps/web/src` por responsabilidades:

- `api/`: contratos de respuesta, cliente HTTP, errores y CSRF en memoria;
- `auth/`: restauración de sesión, guardas de ruta y `PermissionGate`;
- `layouts/`: navegación administrativa y docente;
- `pages/admin/`: flujo institucional secuencial;
- `pages/teacher/`: proyección propia de asignaciones;
- `components/`: estados, campos, paneles y acciones compartidas.

`AuthProvider` consulta `/api/v1/auth/session` al montar. La cookie HttpOnly no es accesible desde React. Un `401` emitido por una solicitud posterior limpia el estado de sesión, reinicia el CSRF en memoria y permite que la guarda redirija a `/login`.

`apiMutation` obtiene `/api/v1/auth/csrf` solo cuando no existe un valor en memoria y envía `x-csrf-token` junto a la cookie CSRF que administra el navegador. Login y logout reinician ese valor. No existe acceso a `localStorage` ni `sessionStorage`.

La UI no replica la evaluación jerárquica. `PermissionGate` consulta la ruta backend de comprobación con un recurso real y solo decide visibilidad. Un enlace visible nunca sustituye la autorización del caso de uso.

### Comandos frontend

```bash
npm run typecheck -w @edugestor/web
npm test -w @edugestor/web -- --run
npm run build -w @edugestor/web
npm run test:e2e
```

El comando E2E ejecuta primero el build. La prueba levanta un servidor estático efímero en `127.0.0.1:4174`, utiliza el Chrome instalado y lo cierra al terminar. Intercepta la API para mantener datos y credenciales ficticios fuera de PostgreSQL.

Para una demo real se usa `npm run dev` con PostgreSQL/API disponibles, `VITE_API_URL` apuntando al backend y cuentas provisionales entregadas fuera del repositorio. Nunca se deben copiar credenciales reales a `.env.example`, documentación, fixtures o código.
