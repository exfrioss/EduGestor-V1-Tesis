import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('GET /health', () => {
  it('informa que la API y PostgreSQL están disponibles', async () => {
    const app = createApp({ checkAvailability: async () => true });
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', database: 'available' });
  });

  it('informa degradación cuando PostgreSQL no está disponible', async () => {
    const app = createApp({ checkAvailability: async () => false });
    const response = await request(app).get('/health');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'degraded', database: 'unavailable' });
  });
});
