# Arquitectura técnica inicial

EduGestor utiliza un monorepo npm con tres workspaces:

```text
apps/
  api/       Node.js + Express + TypeScript
  web/       React + Vite + TypeScript + Tailwind CSS
packages/
  shared/    Tipos y esquemas Zod compartidos
```

El entorno Docker Compose contiene `web`, `api` y `postgres`. El frontend se sirve con Nginx, la API escucha en el puerto 3000 y PostgreSQL 17 mantiene sus datos en un volumen nombrado.

Prisma está configurado para PostgreSQL, pero el esquema no define modelos. El modelo de dominio y sus migraciones permanecen pendientes de `DATABASE.md`.
