import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import pino from 'pino';

const silentLogger = pino({ level: 'silent' });

describe('GET /health', () => {
  it('informa que la API y PostgreSQL están disponibles', async () => {
    const app = createApp({ checkAvailability: async () => true }, { logger: silentLogger });
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', database: 'available' });
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('informa degradación cuando PostgreSQL no está disponible', async () => {
    const app = createApp({ checkAvailability: async () => false }, { logger: silentLogger });
    const response = await request(app).get('/health');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'degraded', database: 'unavailable' });
  });

  it('devuelve errores uniformes y conserva un request ID válido', async () => {
    const app = createApp(
      { checkAvailability: async () => true },
      { logger: silentLogger, allowedOrigins: ['https://allowed.example'] },
    );
    const requestId = 'b67f245c-c371-4c18-9876-daee7e88a412';
    const response = await request(app).get('/missing').set('x-request-id', requestId);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Ruta no encontrada: GET /missing',
        requestId,
      },
    });
  });
});
