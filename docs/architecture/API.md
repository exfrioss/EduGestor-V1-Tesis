# API de infraestructura

## `GET /health`

Comprueba la disponibilidad de la API y ejecuta `SELECT 1` contra PostgreSQL.

Respuesta saludable (`200`):

```json
{
  "status": "ok",
  "database": "available"
}
```

Respuesta degradada (`503`):

```json
{
  "status": "degraded",
  "database": "unavailable"
}
```

No hay otros endpoints implementados en el bootstrap técnico.
