# EduGestor V1.0 — Notas del manual de usuario

## Recorrido del Hito 1

### Ingreso

1. Abrir `http://localhost:5173/login`.
2. Ingresar el usuario y la contraseña provistos por la institución.
3. EduGestor dirige la cuenta a Administración si posee una institución visible; en caso contrario, una cuenta docente abre “Mis asignaciones”.
4. “Cerrar sesión” revoca la sesión en el servidor. No se guarda ningún token en el navegador.

### Recorrido administrativo

1. En **Instituciones**, seleccionar **Administrar**. Una cuenta técnica puede crear la institución inicial con un motivo auditado; una cuenta administrativa ordinaria no ve esa excepción.
2. En **Docentes**, crear un perfil con cuenta nueva o vincular un UUID de usuario existente. La contraseña inicial debe tener al menos 12 caracteres y no vuelve a mostrarse.
3. En **Año y cursos**, crear el año lectivo, marcar el actual y luego crear el curso con grado, sección y turno.
4. En **Materias**, crear el catálogo institucional. La disciplina curricular es opcional.
5. En **Asignaciones**, elegir docente, curso y materia activos y seleccionar **Asignar docente**.
6. Las acciones de desactivar, desvincular o retirar siempre solicitan confirmación y conservan la historia.

### Área docente

“Mis asignaciones” muestra exclusivamente asignaciones vigentes de la cuenta autenticada. Cada tarjeta incluye institución, año lectivo, grado, sección, turno y materia. Una cuenta solo docente no ve navegación administrativa. Conocer un UUID ajeno no habilita su consulta.

### Mensajes habituales

- `401`: la sesión no existe o venció; volver a iniciar sesión.
- `403`: la cuenta no posee permiso y scope para la operación.
- `409`: existe un dato incompatible o duplicado.
- `422`: revisar los campos enviados.

## Dataset ficticio reproducible

El comando `bootstrap:hito1-demo` crea en PostgreSQL local:

- institución `Colegio Horizonte Demo`;
- año lectivo `2026`;
- docentes `Ana Docente Demo` y `Bruno Docente Demo`;
- curso `1.º BTI`, sección `A`, turno `Mañana`;
- materia `Programación I`;
- una asignación vigente para cada docente;
- administrador institucional y permisos/scope necesarios.

Los nombres de login se eligen por variables de entorno. Las contraseñas no tienen valor predeterminado y no deben escribirse en documentación ni archivos versionados.

## Demo manual real, paso a paso

Ejecutar desde la raíz del repositorio en una nueva sesión de PowerShell:

1. Instalar dependencias y preparar la configuración local:

   ```powershell
   npm install
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   $env:NODE_ENV='development'
   $env:DATABASE_URL='postgresql://edugestor:edugestor_dev@localhost:5432/edugestor?schema=public'
   ```

2. Iniciar PostgreSQL y aplicar las migraciones:

   ```powershell
   docker compose up -d postgres
   npm run prisma:migrate:deploy -w @edugestor/api
   ```

3. Elegir credenciales ficticias de al menos 12 caracteres solo para esta sesión. Sustituir cada texto entre `<...>`; no copiar estos valores a `.env`:

   ```powershell
   $env:BOOTSTRAP_ROOT_LOGIN='technical.hito1.demo'
   $env:BOOTSTRAP_ROOT_PASSWORD='<CONTRASENA_TECNICA_LOCAL>'
   $env:BOOTSTRAP_ROOT_REASON='Preparación local de la demo Hito 1'
   npm run bootstrap:root -w @edugestor/api

   $env:HITO1_DEMO_TECHNICAL_LOGIN=$env:BOOTSTRAP_ROOT_LOGIN
   $env:HITO1_DEMO_ADMIN_LOGIN='admin.hito1.demo'
   $env:HITO1_DEMO_ADMIN_PASSWORD='<CONTRASENA_ADMIN_LOCAL>'
   $env:HITO1_DEMO_TEACHER_ONE_LOGIN='ana.hito1.demo'
   $env:HITO1_DEMO_TEACHER_ONE_PASSWORD='<CONTRASENA_ANA_LOCAL>'
   $env:HITO1_DEMO_TEACHER_TWO_LOGIN='bruno.hito1.demo'
   $env:HITO1_DEMO_TEACHER_TWO_PASSWORD='<CONTRASENA_BRUNO_LOCAL>'
   npm run bootstrap:hito1-demo -w @edugestor/api
   ```

4. Levantar la aplicación con cookies compatibles con HTTP local:

   ```powershell
   docker compose up -d --build api web
   Invoke-RestMethod http://localhost:3000/health
   ```

5. Abrir `http://localhost:5173/login` e ingresar como `admin.hito1.demo` usando el valor elegido en `HITO1_DEMO_ADMIN_PASSWORD`.
6. Abrir **Instituciones** y administrar `Colegio Horizonte Demo`.
7. Revisar en orden **Docentes**, **Año y cursos**, **Materias** y **Asignaciones**. Deben existir los dos docentes, el año 2026, el curso, la materia y dos asignaciones.
8. Cerrar sesión.
9. Ingresar como `ana.hito1.demo` usando `HITO1_DEMO_TEACHER_ONE_PASSWORD`.
10. Abrir **Mis asignaciones**. Debe verse `Programación I` en `1.º BTI · A · Mañana` y no deben aparecer controles administrativos.
11. Cerrar sesión.

El bootstrap puede repetirse con el mismo conjunto de variables: corrige el estado ficticio esperado sin duplicar entidades y agrega una auditoría por ejecución.

## Pruebas de navegador

El recorrido rápido simulado permanece disponible:

```powershell
npm run test:e2e
```

Para repetir el recorrido contra API y PostgreSQL reales, mantener los servicios levantados y las variables del administrador y Ana en la misma sesión:

```powershell
npm run test:e2e:real
```

La prueba real también comprueba que Ana puede consultar su propio UUID y recibe `403` al intentar consultar la asignación de Bruno. No usa interceptación de API.

Para demostrar persistencia, ejecutar `docker compose restart api web`, esperar que `GET /health` vuelva a indicar `database: available` y repetir los pasos 5 a 11. Los datos viven en el volumen PostgreSQL y no se eliminan al reiniciar API o web.
