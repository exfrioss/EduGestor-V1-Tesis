import cors from 'cors';
import cookieParser from 'cookie-parser';
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
import { createAuthRouter } from './modules/auth/auth.router.js';
import type { PrismaClient } from '@prisma/client';
import type { AuthConfig } from './config.js';
import { createAuthorizationRouter } from './modules/authorization/authorization.router.js';
import { createAcademicRouter } from './modules/academic/academic.router.js';
import { createCurriculumRouter } from './modules/curriculum/curriculum.router.js';

interface AppOptions {
  allowedOrigins?: string[];
  logger?: Logger;
  auth?: {
    client: PrismaClient;
    config: AuthConfig;
  };
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
  app.use(cookieParser());

  app.use(createHealthRouter(database));
  if (options.auth !== undefined) {
    app.use('/api/v1/auth', createAuthRouter(options.auth.client, options.auth.config));
    app.use(
      '/api/v1/authorization',
      createAuthorizationRouter(options.auth.client, options.auth.config),
    );
    app.use('/api/v1', createAcademicRouter(options.auth.client, options.auth.config));
    app.use('/api/v1', createCurriculumRouter(options.auth.client, options.auth.config));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
