# EduGestor V1.0

Sistema Integral de Gestión y Planificación Docente, desarrollado como proyecto de tesis.

## Estado actual

El repositorio contiene el bootstrap técnico de una arquitectura cliente-servidor:

- `apps/web`: React, Vite, TypeScript y Tailwind CSS.
- `apps/api`: Node.js, Express, TypeScript y Prisma.
- `packages/shared`: tipos y esquemas compartidos.
- PostgreSQL local mediante Docker Compose.

El modelo de dominio está pendiente de la definición de `docs/architecture/DATABASE.md`.

## Requisitos

- Node.js 22 o superior.
- npm 10 o superior.
- Docker Desktop con Docker Compose.

## Inicio rápido

```bash
copy .env.example .env
npm install
npm run dev
```

Para levantar el entorno completo en contenedores:

```bash
docker compose up --build
```

Servicios locales:

- Frontend: http://localhost:5173
- API: http://localhost:3000
- Salud de la API: http://localhost:3000/health
- PostgreSQL: localhost:5432

## Comandos principales

```bash
npm run typecheck
npm run build
npm test
npm run prisma:validate
docker compose config
```

No se incluyen todavía autenticación, permisos, módulos académicos ni entidades de negocio.
