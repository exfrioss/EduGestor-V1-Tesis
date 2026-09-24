# Bootstrap técnico

## Estructura

- `apps/web`: frontend React/Vite/TypeScript/Tailwind CSS.
- `apps/api`: API Node.js/Express/TypeScript.
- `packages/shared`: contratos TypeScript y esquemas Zod compartidos.
- `apps/api/prisma/schema.prisma`: configuración PostgreSQL sin modelos de negocio.

## Configuración local

1. Copiar `.env.example` a `.env`.
2. Ejecutar `npm install`.
3. Iniciar PostgreSQL con `docker compose up -d postgres`.
4. Ejecutar `npm run dev`.

El endpoint `GET /health` devuelve `200` cuando PostgreSQL responde y `503` cuando la base de datos no está disponible.

## Verificación

```bash
npm run prisma:validate
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

No hay migraciones ni tablas de dominio. Se crearán después de aprobar `docs/architecture/DATABASE.md`.
