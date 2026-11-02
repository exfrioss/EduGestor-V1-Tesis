import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  DATABASE_URL: z.string().url(),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(168).default(8),
  SESSION_LAST_SEEN_INTERVAL_SECONDS: z.coerce.number().int().positive().max(3_600).default(300),
  AUTH_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default('edugestor_session'),
  CSRF_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default('edugestor_csrf'),
  LOGIN_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().max(1_440).default(15),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().max(1_000).default(5),
  CONFIRMATION_HMAC_KEYS: z.string().optional(),
  CONFIRMATION_ACTIVE_KID: z.string().optional(),
});

export interface AuthConfig {
  confirmationKeys?: Record<string, string>;
  confirmationActiveKid?: string;
  sessionTtlMs: number;
  lastSeenIntervalMs: number;
  sessionCookieName: string;
  csrfCookieName: string;
  secureCookies: boolean;
  loginRateLimitWindowMs: number;
  loginRateLimitMaxAttempts: number;
}

export interface Environment {
  NODE_ENV: 'development' | 'test' | 'production';
  API_PORT: number;
  DATABASE_URL: string;
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  corsAllowedOrigins: string[];
  auth: AuthConfig;
}

export const loadEnvironment = (source: NodeJS.ProcessEnv = process.env): Environment => {
  const parsed = environmentSchema.parse(source);
  let confirmationKeys: Record<string, string> | undefined;
  if (parsed.CONFIRMATION_HMAC_KEYS) {
    const value: unknown = JSON.parse(parsed.CONFIRMATION_HMAC_KEYS);
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.entries(value).some(([kid, secret]) => !/^[A-Za-z0-9_-]{1,32}$/.test(kid) || typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32)) throw new Error('CONFIRMATION_HMAC_KEYS inválido');
    confirmationKeys = value as Record<string, string>;
  }
  if (parsed.CONFIRMATION_ACTIVE_KID && !confirmationKeys?.[parsed.CONFIRMATION_ACTIVE_KID]) throw new Error('CONFIRMATION_ACTIVE_KID sin clave');
  const corsAllowedOrigins = parsed.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsAllowedOrigins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS debe contener al menos un origen');
  }

  return {
    NODE_ENV: parsed.NODE_ENV,
    API_PORT: parsed.API_PORT,
    DATABASE_URL: parsed.DATABASE_URL,
    LOG_LEVEL: parsed.LOG_LEVEL,
    corsAllowedOrigins,
    auth: {
      confirmationKeys,
      confirmationActiveKid: parsed.CONFIRMATION_ACTIVE_KID,
      sessionTtlMs: parsed.SESSION_TTL_HOURS * 60 * 60 * 1_000,
      lastSeenIntervalMs: parsed.SESSION_LAST_SEEN_INTERVAL_SECONDS * 1_000,
      sessionCookieName: parsed.AUTH_COOKIE_NAME,
      csrfCookieName: parsed.CSRF_COOKIE_NAME,
      secureCookies: parsed.NODE_ENV === 'production',
      loginRateLimitWindowMs: parsed.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1_000,
      loginRateLimitMaxAttempts: parsed.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    },
  };
};
