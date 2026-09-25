# EduGestor V1.0 — Evidencia y aceptación del Hito 1

**Fecha de cierre técnico:** 25/09/2026  
**Estado:** ACEPTADO para el alcance delimitado del Hito 1  
**Resultado:** sin defectos bloqueantes conocidos dentro del alcance  
**Línea base:** `REQUIREMENTS.md` y `DATABASE.md`; ambos permanecen sin modificaciones

## 1. Propósito y fuentes

Este documento consolida la evidencia de implementación y validación del Hito 1. No modifica requisitos, decisiones de negocio ni el modelo normativo, y no implica la aceptación completa de EduGestor V1.0.

Fuentes utilizadas:

- [`REQUIREMENTS.md`](../project/REQUIREMENTS.md): RF-001 a RF-007 y requisitos no funcionales aplicables.
- [`DATABASE.md`](../architecture/DATABASE.md): subconjunto mínimo de 16 entidades y recorrido verificable del Hito 1.
- [`PROJECT_CONTEXT.md`](../project/PROJECT_CONTEXT.md): estado estable del checkpoint y validación real final.
- [`CHANGELOG.md`](../project/CHANGELOG.md): evolución de persistencia, autenticación, autorización, backend académico, frontend y cierre técnico.
- [`TESTS.md`](../tests/TESTS.md): comandos, ambientes y resultados efectivamente ejecutados.

## 2. Alcance aceptado

El Hito 1 materializa la primera versión estructural funcional de EduGestor. Comprende:

- RF-001: autenticación y sesiones.
- RF-002: roles, permisos explícitos, ámbitos, delegación jerárquica e aislamiento docente.
- RF-003: gestión de instituciones.
- RF-004: gestión de docentes, cuentas y vínculos institucionales.
- RF-005: año lectivo y cursos con contexto Institución + Año Lectivo + Año/Grado + Sección + Turno.
- RF-006: catálogo institucional genérico de materias.
- RF-007: asignación Docente–Curso–Materia y consulta docente de asignaciones propias.
- Auditoría transversal desde el bootstrap y las operaciones administrativas.
- Frontend administrativo y portal docente necesarios para demostrar el recorrido.
- Entorno local reproducible con Docker Compose y PostgreSQL.

El mínimo persistido está compuesto por `User`, `AuthSession`, `Role`, `Permission`, `AccessScope`, `ScopeCourse`, `RoleAssignment`, `RoleAssignmentPermission`, `Institution`, `AcademicYear`, `Teacher`, `TeacherInstitution`, `Course`, `Subject`, `TeachingAssignment` y `AuditLog`.

Quedan expresamente fuera de esta aceptación estudiantes y matrículas, tareas, evaluaciones, calificaciones, asistencia, seguimiento, informes, importación/exportación, consulta pública, currículo, planificación e IA.

## 3. Arquitectura utilizada

```text
Navegador
  → React + Vite + TypeScript + Tailwind CSS
  → API REST HTTP/JSON
  → Express + TypeScript
  → middleware de sesión, CSRF, autorización, validación y errores
  → controller → service/use-case → repository
  → Prisma Client
  → PostgreSQL 17
```

La solución se organiza como monorepo npm:

- `apps/web`: interfaz React, rutas protegidas, cliente HTTP y layouts administrativo/docente.
- `apps/api`: Express, módulos de autenticación, autorización y núcleo académico.
- `packages/shared`: contratos y utilidades TypeScript compartidas.
- Docker Compose: servicios `web`, `api` y `postgres`.

La integridad se reparte conforme a `DATABASE.md`: PostgreSQL mantiene PK/FK, restricciones, índices, triggers y conservación histórica; Prisma gestiona relaciones y transacciones; Zod valida entradas; el backend resuelve permisos, scope, contexto y reglas entre entidades.

## 4. Funcionalidades implementadas

### 4.1. Autenticación y sesiones

- Login, logout, restauración y consulta de sesión.
- Sesiones opacas persistidas en `AuthSession` con expiración absoluta y revocación.
- Actualización acotada de `lastSeenAt` sin convertir la expiración en deslizante.
- Invalidación de sesiones al desactivar `User` o `Teacher`.
- Respuesta uniforme ante usuario inexistente, contraseña incorrecta o cuenta desactivada.
- Cookie administrada por el navegador; el frontend no conserva credenciales de sesión en Web Storage.

### 4.2. Autorización jerárquica

- Denegación por defecto y evaluación backend de permiso y ámbito.
- Ámbitos institucionales y conjuntos de cursos.
- Prohibición de combinar el permiso de una concesión con el scope de otra.
- Múltiples roles sin privilegio global por acumulación implícita.
- Delegación D-01 limitada a permisos propios y ámbitos iguales o más restringidos.
- Procedencia mediante `parentGrantId`, prevención de ciclos y revocación efectiva de descendientes.
- Rechazo explícito de `RESOURCE_SET`, todavía fuera del Hito 1.

### 4.3. Núcleo institucional y académico

- Altas, consultas, actualizaciones y cambios de estado sin borrado físico para instituciones, docentes, cursos y materias.
- Creación transaccional de cuenta, perfil docente y vínculo institucional.
- Año lectivo institucional y control de un único año actual.
- Curso único por institución, año, grado, sección y turno normalizados.
- Materias institucionales genéricas; la disciplina curricular es opcional.
- Creación, consulta, listado, retiro lógico y reactivación válida de `TeachingAssignment`.
- Validación de institución, docente, vínculo, curso y materia activos y coherentes.
- Endpoint docente `GET /api/v1/me/teaching-assignments`, derivado de la sesión y sin aceptar un docente indicado por el cliente.

### 4.4. Frontend demostrable

- Login, restauración de sesión, logout, CSRF en memoria y transporte con `credentials: "include"`.
- Rutas privadas, páginas 403/404 y redirección por capacidades observables del backend.
- Flujo administrativo secuencial: Institución → Docentes → Año/curso → Materias → Asignaciones.
- Portal docente “Mis asignaciones” sin controles administrativos para una cuenta exclusivamente docente.
- Estados de carga, vacío y error; tratamiento de 401, 403, 409 y 422; confirmaciones para acciones sensibles.
- Foco inicial y de navegación, contorno visible para teclado, etiquetas y salida accesible en vista móvil.

### 4.5. Datos de demostración

El comando CLI `npm run bootstrap:hito1-demo -w @edugestor/api` provisiona datos ficticios de forma idempotente. Solo funciona en `development` o `test`, exige credenciales por variables de entorno y no expone ni versiona contraseñas. Crea administrador, institución, año, dos docentes/cuentas, curso, materia, dos asignaciones, rol, permisos, scope y auditoría.

## 5. Recorrido manual de aceptación

Precondiciones: PostgreSQL iniciado, cuatro migraciones aplicadas, dataset ficticio provisionado y `NODE_ENV=development` para la demostración HTTP local.

1. Abrir `/login` e ingresar con el administrador institucional ficticio.
2. Confirmar la institución visible y entrar mediante **Administrar**.
3. Abrir **Docentes** y comprobar cuentas, perfiles, vínculo y estado.
4. Abrir **Año y cursos** y comprobar año lectivo actual, grado, sección y turno.
5. Abrir **Materias** y comprobar el catálogo institucional.
6. Abrir **Asignaciones** y comprobar las relaciones Docente–Curso–Materia vigentes.
7. Cerrar la sesión administrativa.
8. Ingresar con uno de los docentes ficticios.
9. Abrir **Mis asignaciones** y verificar institución, año, grado, sección, turno y materia.
10. Confirmar que la cuenta docente no muestra navegación administrativa.
11. Comprobar mediante la API autenticada que su asignación responde `200` y el UUID de la asignación del segundo docente responde `403`.
12. Cerrar sesión y confirmar que la sesión anterior deja de autorizar solicitudes privadas.

Los detalles de provisionamiento y las variables requeridas están documentados en las notas del manual de usuario y no se repiten aquí para evitar convertir este acta en un almacén de credenciales.

## 6. Pruebas ejecutadas

Los siguientes resultados provienen de ejecuciones registradas en `TESTS.md`; no son pruebas inferidas ni pendientes:

| Nivel | Verificación | Resultado final |
|---|---|---|
| Esquema | `npm run prisma:validate` | Aprobado |
| Cliente ORM | `npm run prisma:generate` | Prisma Client 6.12.0 generado |
| Migración | Base PostgreSQL vacía | 4/4 migraciones aplicadas |
| Estado | `prisma migrate status` | Esquema de desarrollo al día |
| TypeScript | `npm run typecheck` | Shared, API y Web aprobados |
| Build | `npm run build` | Shared, API y Vite aprobados; 104 módulos frontend |
| Suite ordinaria | `npm test` | Shared 1/1, API 13/13, Web 8/8 |
| Integración real | `RUN_DATABASE_TESTS=1` sobre base aislada | 11 archivos, 60/60 pruebas aprobadas |
| E2E controlado | `npm run test:e2e` | 1/1 aprobado |
| E2E real | `npm run test:e2e:real` | 1/1 aprobado |
| E2E tras reinicio | Reinicio de API/web y repetición | 1/1 aprobado |

La suite ordinaria omite por diseño 47 pruebas dependientes de base cuando `RUN_DATABASE_TESTS` no está activo. Esas pruebas sí fueron ejecutadas en la corrida de integración PostgreSQL de 60/60.

### 6.1. Cobertura relevante

- Login válido e inválido, cuenta inexistente/inactiva, cookie, sesión válida/expirada/revocada y logout.
- Solicitud privada sin sesión y mutación autenticada sin CSRF.
- Revocación de sesiones al desactivar usuario o docente.
- Ausencia de contraseña, hash o token en respuestas, auditoría y logs inspeccionados.
- Permiso/scope correcto e incorrecto, prohibición de mezclar concesiones y revocación.
- Delegación válida, permiso o scope excesivo, autoelevación y ciclo.
- Usuario con múltiples roles sin escalamiento global.
- CRUD y cambios de estado del núcleo institucional dentro del ámbito autorizado.
- Año actual único, curso y asignación duplicados, cruces institucionales y entidades inactivas.
- Acceso docente propio, rechazo de asignación ajena y retiro lógico con conservación histórica.
- Interfaz: login, restauración, rutas protegidas, permisos visibles, formularios, errores, vacío docente y ausencia de controles administrativos.

## 7. E2E real: React → Express → PostgreSQL

`e2e/hito1-real.spec.ts` ejecuta el navegador contra el frontend servido en `http://localhost:5173`. El frontend llama a la API real en `http://localhost:3000`, y Express utiliza Prisma contra PostgreSQL. Esta prueba no usa `page.route`, mocks de autenticación, respuestas sintéticas ni persistencia en memoria.

Recorrido automatizado:

```text
login administrador
→ institución
→ docentes
→ año lectivo/curso
→ materias
→ TeachingAssignment
→ logout
→ login docente
→ Mis asignaciones
→ asignación propia 200
→ asignación ajena 403
→ logout
```

También verifica foco del login, navegación por teclado, foco del encabezado y disponibilidad del logout en 390 × 844.

## 8. Persistencia después del reinicio

Se reiniciaron únicamente los contenedores `api` y `web`, conservando el volumen de PostgreSQL. Después del reinicio:

- `GET /health` devolvió `status=ok` y `database=available`.
- Administrador y docente pudieron iniciar sesión nuevamente.
- Las asignaciones continuaron visibles.
- El E2E real volvió a aprobar 1/1.
- Una consulta directa confirmó 2 asignaciones vigentes y 2 entradas `demo.hito1.bootstrap` en `AuditLog`.

Esto acepta la permanencia tras recarga/reinicio aplicable a RNF-007 CA1 y la consulta coherente por sesiones autorizadas. No constituye todavía un ensayo de backup/restauración de RF-024 o RNF-007 CA3–CA4.

## 9. Seguridad comprobada

- Hash de contraseña `scrypt` con sal; no hay almacenamiento reversible o en texto plano.
- Token de sesión opaco generado criptográficamente; PostgreSQL conserva solamente su hash SHA-256.
- Cookie de sesión `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- Expiración absoluta, revocación, logout y actualización segura de actividad.
- Token CSRF de doble envío para mutaciones autenticadas.
- Rate limiting de login y respuesta uniforme que evita enumeración de usuarios.
- CORS configurable, Helmet, request ID, errores uniformes y logging con redacción de secretos.
- Backend como autoridad efectiva; `PermissionGate` solo controla presentación.
- Denegación por defecto, permiso y scope procedentes de la misma concesión, delegación acotada y auditoría.
- El UUID de otra asignación no concede acceso: el E2E real verificó `403`.
- Desactivar docente o usuario revoca sesiones existentes y bloquea nuevos accesos.
- El frontend no escribe token o credenciales en `localStorage`/`sessionStorage` y nunca accede directamente a PostgreSQL.
- Bootstrap técnico y de demostración sin credenciales fijas, limitado por entorno y auditado.

## 10. Incidencias encontradas y corregidas

| Incidencia | Corrección y verificación |
|---|---|
| Un proceso Node retenía el binario de Prisma y produjo `EPERM` durante `prisma generate`. | Se identificó y detuvo únicamente el proceso correspondiente; la generación repetida aprobó. |
| Un alias SQL reservado y la revalidación del padre interferían con la revocación. | Se corrigieron SQL y regla de trigger mediante migración versionada; autorización volvió a aprobar desde base vacía. |
| Conflictos serializables Prisma `P2034` aparecieron en delegación/operaciones académicas. | Se añadieron reintentos acotados de hasta tres intentos; las suites finales aprobaron. |
| El bootstrap de demostración sincronizaba el catálogo dentro de una transacción serializable concurrente. | La sincronización se movió antes de la transacción del dataset; integración final 60/60. |
| Reutilizar una base alterada por una corrida fallida causó colisiones de fixtures históricos. | La aceptación final se ejecutó sobre una nueva base aislada y vacía. |
| El foco inicial competía con la restauración asíncrona de sesión. | `RouteFocus` espera el contenido, prioriza el control inicial y limita/desconecta el observador; RTL y E2E aprobaron. |
| Las primeras consultas diagnósticas de persistencia usaron escape incorrecto y una columna `status` inexistente. | Se corrigió la consulta de solo lectura para usar `endedAt IS NULL`; no hubo alteración de datos. |

No quedan defectos bloqueantes documentados para el Hito 1.

## 11. Limitaciones actuales

- La aceptación se limita a RF-001–RF-007 y al soporte transversal necesario; no acepta el resto de V1.0.
- `RESOURCE_SET` no está implementado y se rechaza explícitamente; el Hito 1 solo habilita institución y conjunto de cursos.
- El ensayo realizado valida persistencia después de reiniciar servicios, no recuperación desde backup.
- La comprobación automatizada responsive cubre 390 × 844 y el recorrido manual dispone de evidencia de escritorio; la matriz completa de anchos global de V1.0 seguirá ampliándose con los demás módulos.
- El E2E real cubre el recorrido del Hito 1. Los escenarios E2E de tareas, asistencia, planificación, IA, consulta pública e importación pertenecen a hitos posteriores.
- El provisionador de demostración es exclusivamente local/test y se niega a ejecutarse en producción.
- La cuenta técnica se reserva al bootstrap y acciones excepcionales; no forma parte de los recorridos cotidianos.
- Las capturas disponibles son evidencia visual complementaria de una ejecución manual y pueden contener datos ficticios distintos del dataset determinista del E2E. La evidencia automatizada y PostgreSQL es la fuente de verificación funcional.

## 12. Evidencia disponible

### 12.1. Evidencia documental y ejecutable

- Resultados y comandos: [`TESTS.md`](../tests/TESTS.md).
- Estado final: [`PROJECT_CONTEXT.md`](../project/PROJECT_CONTEXT.md).
- Historia de implementación: [`CHANGELOG.md`](../project/CHANGELOG.md).
- E2E real: [`e2e/hito1-real.spec.ts`](../../e2e/hito1-real.spec.ts).
- Configuración E2E real: [`playwright.real.config.ts`](../../playwright.real.config.ts).
- Bootstrap idempotente: [`bootstrap-hito1-demo.ts`](../../apps/api/src/commands/bootstrap-hito1-demo.ts).
- Prueba de integración del bootstrap: [`demo-bootstrap.integration.test.ts`](../../apps/api/src/demo-bootstrap.integration.test.ts).
- Cuatro migraciones versionadas: [`apps/api/prisma/migrations`](../../apps/api/prisma/migrations/).

### 12.2. Evidencia visual

| Archivo | Contenido observado |
|---|---|
| [`login.PNG`](hito1/login.PNG) | Pantalla inicial de autenticación y foco visible. |
| [`02.PNG`](hito1/02.PNG) | Institución visible dentro del área administrativa. |
| [`03.PNG`](hito1/03.PNG) | Gestión de docentes, cuentas, vínculos y estados. |
| [`04.PNG`](hito1/04.PNG) | Año lectivo y cursos con grado, sección y turno. |
| [`05.PNG`](hito1/05.PNG) | Catálogo institucional de materias. |
| [`06.PNG`](hito1/06.PNG) | Listado y creación de asignaciones docentes. |
| [`07.PNG`](hito1/07.PNG) | Rechazo visible de una sesión inválida o expirada. |
| [`08.PNG`](hito1/08.PNG) | Portal docente “Mis asignaciones”, sin controles administrativos. |

Las capturas no contienen contraseñas en claro. La presencia de datos en pantalla demuestra presentación, pero no sustituye las pruebas automatizadas de autorización, persistencia e integridad.

## 13. Matriz resumida de aceptación

| Requisito | Método principal | Resultado del Hito 1 |
|---|---|---|
| RF-001 | Integración PostgreSQL + Supertest + E2E real | Aceptado |
| RF-002 | Integración de autorización + acceso ajeno `403` | Aceptado para `INSTITUTION` y `COURSE_SET`; `RESOURCE_SET` diferido y rechazado |
| RF-003 | Integración académica + frontend/manual | Aceptado |
| RF-004 | Integración transaccional, revocación + frontend/manual | Aceptado |
| RF-005 | Restricciones PostgreSQL/servicio + frontend/manual | Aceptado |
| RF-006 | Integración + frontend/manual | Aceptado |
| RF-007 | Integración + E2E real + persistencia tras reinicio | Aceptado |
| RNF-001 | Inspección de arquitectura + typecheck/build | Aceptado para módulos del Hito 1 |
| RNF-002–RNF-005 | Unitarias, integración, Supertest e inspección | Aceptado para el alcance implementado |
| RNF-007 | Reinicio y reconsulta de PostgreSQL | Parcial global: persistencia aceptada; backup/restauración pendiente |
| RNF-008 | RTL, E2E a 390 × 844 y evidencia de escritorio | Aceptado para el recorrido del Hito 1; cobertura global continúa |
| RNF-009 | Docker Compose, migraciones vacías y bootstrap sin secretos | Aceptado para entorno local |
| RNF-010 | Vitest, Supertest, RTL e integración real | Aceptado para reglas del Hito 1 |
| RNF-011 | Playwright simulado y real | Aceptado para el recorrido del Hito 1; escenarios posteriores fuera de alcance |
| RNF-012 | `TESTS.md`, contexto, changelog y este documento | Aceptado para el Hito 1 |

## 14. Conclusión de aceptación

El Hito 1 se considera **aceptado técnicamente** porque el recorrido definido en `DATABASE.md` y los requisitos RF-001–RF-007 fueron implementados y demostrados mediante pruebas unitarias, integración PostgreSQL, frontend, E2E controlado y E2E real. La cadena React → Express → Prisma → PostgreSQL fue ejercitada sin API simulada; los datos y la auditoría persistieron después de reiniciar API/web; y los controles esenciales de sesión, CSRF, autorización jerárquica, aislamiento docente e integridad produjeron los resultados esperados.

Esta conclusión no amplía el alcance ni declara completa EduGestor V1.0. El siguiente trabajo funcional deberá comenzar únicamente después de aprobar su alcance y sus decisiones normativas, conservando este checkpoint como línea base estable del Hito 1.
