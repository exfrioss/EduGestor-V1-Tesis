import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  DATABASE_URL: z.string().url(),
});

export type Environment = z.infer<typeof environmentSchema>;

export const loadEnvironment = (source: NodeJS.ProcessEnv = process.env): Environment =>
  environmentSchema.parse(source);
