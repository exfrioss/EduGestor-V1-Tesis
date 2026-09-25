# EduGestor V1.0 — Contexto de continuidad

## CHECKPOINT COMPLETADO — Validación real del Hito 1

**Fecha:** 25/09/2026.

**Estado:** estable; sin commit Git.

### Implementado

- Comando CLI idempotente `npm run bootstrap:hito1-demo -w @edugestor/api` para provisionar exclusivamente en `development` o `test` el conjunto ficticio del Hito 1.
- El comando exige por entorno una cuenta técnica existente, tres logins y tres contraseñas; no contiene credenciales predeterminadas ni expone contraseñas, hashes o tokens.
- Dataset reproducible con institución, año lectivo, dos docentes/cuentas/vínculos, curso, materia, dos `TeachingAssignment`, rol administrativo, scope institucional, 13 permisos y auditoría por ejecución.
- Identificadores reservados estables y operaciones `upsert` permiten repetir el provisionamiento sin duplicar entidades. Cada invocación conserva su propio `AuditLog`.
- Protección explícita contra ejecución en producción y validación de contraseñas de al menos 12 caracteres y logins distintos.
- E2E Playwright real, separado del escenario simulado, contra React en `:5173`, Express en `:3000` y PostgreSQL en `:5432`; no intercepta API, autenticación, autorización ni persistencia.
- Revisión breve de accesibilidad/UX: foco inicial y al navegar, foco visible, tabulación de login, contraste de etiquetas, salida accesible en ancho móvil y conservación de estados de carga/vacío/error y confirmaciones existentes.

### Recorrido real validado

Administrador inicia sesión → comprueba institución → docentes → año/curso → materia → asignaciones → cierra sesión → docente inicia sesión → ve únicamente su asignación → acceso propio `200` → UUID ajeno `403` → cierra sesión.

Después de reiniciar los contenedores `api` y `web`, ambas cuentas volvieron a iniciar sesión, las dos asignaciones siguieron disponibles y PostgreSQL conservó dos eventos `demo.hito1.bootstrap`.

### Persistencia y migraciones

- El schema Prisma y las cuatro migraciones normativas permanecen sin cambios.
- Las cuatro migraciones se aplicaron satisfactoriamente desde una base PostgreSQL vacía.
- `prisma migrate status` informó la base de desarrollo al día.
- Consulta directa posterior al reinicio: 2 asignaciones vigentes y 2 auditorías de bootstrap.

### Pruebas ejecutadas y resultado

- `npm run prisma:validate`: aprobado.
- `npm run prisma:generate`: aprobado.
- Migración desde base vacía: 4/4 aplicadas.
- Integración PostgreSQL completa: 11 archivos, 60/60 pruebas aprobadas.
- `npm run typecheck`: 3 workspaces aprobados.
- `npm run build`: shared, API y frontend aprobados; Vite transformó 104 módulos.
- `npm test`: shared 1/1, API ordinaria 13/13 y React 8/8; las integraciones PostgreSQL se omiten por diseño en esta orden ordinaria.
- `npm run test:e2e`: escenario simulado existente 1/1 aprobado.
- `npm run test:e2e:real`: escenario real 1/1 aprobado antes y después de reiniciar API/web; corrida final 2,3 s.
- `GET /health` después del reinicio: `status=ok`, `database=available`.

### Errores encontrados y corregidos

- La primera integración del bootstrap detectó un conflicto serializable `P2034` al sincronizar el catálogo en paralelo. La sincronización se separó de la transacción del dataset y el bootstrap conserva reintentos acotados; la corrida final desde cero aprobó 60/60.
- Reutilizar una base ya alterada por una corrida fallida produjo colisiones esperables en pruebas históricas. La validación final se repitió sobre una base nueva y vacía.
- El foco inicial podía competir con la restauración asíncrona de sesión. `RouteFocus` ahora espera el contenido de ruta, prioriza el control inicial y desconecta su observador con límite temporal.
- Durante la consulta manual de persistencia se corrigieron dos expresiones SQL de diagnóstico (escape de identificadores y uso de `endedAt` en lugar de una columna inexistente); no hubo cambio de código ni datos por esos intentos fallidos.

### Límites vigentes

- El bootstrap de demostración no crea nuevas entidades de dominio ni modifica el schema Prisma.
- Las contraseñas deben suministrarse en variables de entorno de la sesión; `.env.example` solo documenta nombres vacíos.
- Compose mantiene `NODE_ENV=production` por defecto. Para una demostración HTTP local debe definirse explícitamente `NODE_ENV=development`; en producción la cookie sigue siendo `Secure`.
- El E2E simulado se conserva para pruebas rápidas del frontend y el nuevo E2E real se ejecuta mediante un comando separado.
- No se implementaron estudiantes, tareas, asistencia, currículo, planificación ni IA.

### Siguiente checkpoint exacto

**Aceptación manual y cierre documental del Hito 1 con las personas responsables; definir y aprobar normativamente el siguiente hito antes de ampliar el dominio o iniciar nuevos módulos académicos.**
