import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  DATABASE_URL: z.string().url(),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export type Environment = Omit<z.infer<typeof environmentSchema>, 'CORS_ALLOWED_ORIGINS'> & {
  corsAllowedOrigins: string[];
};

export const loadEnvironment = (source: NodeJS.ProcessEnv = process.env): Environment => {
  const parsed = environmentSchema.parse(source);
  const corsAllowedOrigins = parsed.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsAllowedOrigins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS debe contener al menos un origen');
  }

  const { CORS_ALLOWED_ORIGINS: _rawOrigins, ...environment } = parsed;
  return { ...environment, corsAllowedOrigins };
};
