import cors from 'cors';
import express from 'express';
import { healthResponseSchema } from '@edugestor/shared';
import type { DatabaseProbe } from './database.js';

export const createApp = (database: DatabaseProbe) => {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json());

  app.get('/health', async (_request, response) => {
    try {
      const available = await database.checkAvailability();
      const body = healthResponseSchema.parse({
        status: available ? 'ok' : 'degraded',
        database: available ? 'available' : 'unavailable',
      });
      response.status(available ? 200 : 503).json(body);
    } catch {
      response.status(503).json(
        healthResponseSchema.parse({ status: 'degraded', database: 'unavailable' }),
      );
    }
  });

  return app;
};
