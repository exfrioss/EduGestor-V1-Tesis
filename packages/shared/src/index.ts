import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  database: z.enum(['available', 'unavailable']),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
