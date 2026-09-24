import { healthResponseSchema } from '@edugestor/shared';
import { Router } from 'express';
import type { DatabaseProbe } from '../../database.js';

export const createHealthRouter = (database: DatabaseProbe): Router => {
  const router = Router();

  router.get('/health', async (request, response) => {
    try {
      const available = await database.checkAvailability();
      const body = healthResponseSchema.parse({
        status: available ? 'ok' : 'degraded',
        database: available ? 'available' : 'unavailable',
      });
      response.status(available ? 200 : 503).json(body);
    } catch (error) {
      request.log.warn({ error }, 'PostgreSQL no está disponible');
      response.status(503).json(
        healthResponseSchema.parse({ status: 'degraded', database: 'unavailable' }),
      );
    }
  });

  return router;
};
