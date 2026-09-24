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

## Autenticación Hito 1

Todas las respuestas de autenticación incluyen `Cache-Control: no-store`. Los errores siguen el contrato:

```json
{
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Se requiere una sesión válida",
    "requestId": "uuid"
  }
}
```

### `POST /api/v1/auth/login`

Entrada:

```json
{
  "login": "usuario",
  "password": "contraseña"
}
```

Con credenciales válidas devuelve `200`, una proyección segura del usuario y la expiración absoluta:

```json
{
  "user": {
    "id": "uuid",
    "login": "usuario",
    "accountKind": "STANDARD",
    "teacher": null
  },
  "session": {
    "expiresAt": "2026-09-25T00:00:00.000Z"
  }
}
```

El token opaco se entrega exclusivamente mediante la cookie configurada —`edugestor_session` por defecto— con `HttpOnly`, `SameSite=Lax`, `Path=/`, expiración absoluta y `Secure` en producción. Nunca se devuelve en JSON ni se almacena en el navegador mediante `localStorage` o `sessionStorage`.

Usuario inexistente, contraseña incorrecta, `User` inactivo y `Teacher` inactivo devuelven el mismo `401 INVALID_CREDENTIALS`. Una entrada inválida devuelve `400 VALIDATION_ERROR`. El límite por IP devuelve `429 LOGIN_RATE_LIMITED`.

### `GET /api/v1/auth/session`

Requiere la cookie de sesión. Devuelve `200` con la misma proyección segura de usuario y expiración. Una cookie ausente, desconocida, vencida, revocada o perteneciente a una cuenta desactivada devuelve `401 AUTHENTICATION_REQUIRED`.

La lectura puede actualizar `lastSeenAt` cuando supera el intervalo configurado. Esta actualización nunca cambia `expiresAt`.

### `GET /api/v1/auth/csrf`

Requiere sesión válida. Devuelve un token anti-CSRF y establece la cookie legible configurada —`edugestor_csrf` por defecto—:

```json
{
  "csrfToken": "token-anti-csrf"
}
```

Este valor no autentica al usuario. Las operaciones mutables autenticadas deben enviar simultáneamente la cookie y el mismo valor en `X-CSRF-Token`.

### `POST /api/v1/auth/logout`

Requiere sesión válida y protección CSRF. Revoca la fila `AuthSession`, limpia ambas cookies y devuelve `204` sin cuerpo. Una sesión ausente/inválida devuelve `401`; CSRF ausente o discordante devuelve `403 CSRF_TOKEN_INVALID`.

## Sesiones y seguridad

- Los tokens de sesión contienen 256 bits aleatorios y PostgreSQL almacena únicamente su hash SHA-256.
- La expiración es absoluta; por defecto dura 8 horas y no se renueva por actividad.
- Logout y desactivación de `User`/`Teacher` revocan sesiones persistidas.
- Login y logout se auditan sin guardar login enviado, contraseña, hash, cookie, token opaco ni token CSRF.
- El rate limiting actual usa memoria de la instancia Node. Un despliegue con múltiples réplicas debe usar un store compartido.
- `requireAuthenticated` es el middleware base para rutas privadas. Las futuras rutas mutables con cookie deberán incorporar también la comprobación CSRF.
