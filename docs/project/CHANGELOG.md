# Changelog

## 24/09/2026 — Persistencia y fundaciones backend del Hito 1

- Se incorporaron los 16 modelos aprobados para el checkpoint en Prisma.
- Se creó la migración inicial versionada `20260924160000_initial_hito1` con restricciones PostgreSQL adicionales.
- Se reemplazó el probe `pg` por acceso compartido mediante Prisma Client.
- Se añadieron configuración validada, request ID, errores uniformes, Helmet, CORS configurable y logging estructurado con redacción.
- Se añadieron contratos de repositorio y repositorios iniciales de usuario y auditoría.
- Se añadió hashing `scrypt` y el bootstrap raíz/técnico idempotente, configurado exclusivamente por entorno y auditado de forma atómica.
- La API contenedorizada aplica las migraciones pendientes antes de iniciar y recibe CORS/logging mediante variables de entorno.
- Se incorporaron pruebas unitarias y pruebas de integración de persistencia sobre PostgreSQL.
- No se añadieron pantallas, CRUD de negocio, estudiantes, evaluaciones, asistencia, currículo, planificación ni IA.
