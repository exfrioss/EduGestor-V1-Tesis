import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { DatabaseProbe } from './database.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestId } from './middleware/request-id.js';
import { logger as defaultLogger } from './logging/logger.js';
import type { Logger } from 'pino';
import { createHealthRouter } from './modules/health/health.router.js';

interface AppOptions {
  allowedOrigins?: string[];
  logger?: Logger;
}

export const createApp = (database: DatabaseProbe, options: AppOptions = {}) => {
  const app = express();
  const allowedOrigins = options.allowedOrigins ?? ['http://localhost:5173'];
  const logger = options.logger ?? defaultLogger;

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(pinoHttp({ logger, autoLogging: true }));
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (origin === undefined || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use(createHealthRouter(database));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
