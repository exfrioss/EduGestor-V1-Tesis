import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadEnvironment } from './config.js';
import { createDatabaseProbe, createPrismaClient } from './database.js';
import { createLogger } from './logging/logger.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDirectory, '../../../.env'), quiet: true });

const environment = loadEnvironment();
const logger = createLogger(environment.LOG_LEVEL);
const prisma = createPrismaClient(environment.DATABASE_URL);
const database = createDatabaseProbe(prisma);
const app = createApp(database, {
  allowedOrigins: environment.corsAllowedOrigins,
  logger,
});

const server = app.listen(environment.API_PORT, '0.0.0.0', () => {
  logger.info({ port: environment.API_PORT }, 'EduGestor API iniciada');
});

const shutdown = (signal: NodeJS.Signals) => {
  logger.info({ signal }, 'Cerrando EduGestor API');
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
