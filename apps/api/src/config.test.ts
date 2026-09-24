import { describe, expect, it } from 'vitest';
import { loadEnvironment } from './config.js';

describe('loadEnvironment', () => {
  it('valida y normaliza los orígenes CORS', () => {
    const result = loadEnvironment({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/database',
      CORS_ALLOWED_ORIGINS: 'http://localhost:5173, https://edugestor.example',
    });

    expect(result.corsAllowedOrigins).toEqual([
      'http://localhost:5173',
      'https://edugestor.example',
    ]);
  });

  it('activa cookies Secure únicamente en producción y documenta expiración absoluta', () => {
    const result = loadEnvironment({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/database',
      SESSION_TTL_HOURS: '8',
      SESSION_LAST_SEEN_INTERVAL_SECONDS: '300',
    });

    expect(result.auth.secureCookies).toBe(true);
    expect(result.auth.sessionTtlMs).toBe(8 * 60 * 60 * 1_000);
    expect(result.auth.lastSeenIntervalMs).toBe(300_000);
  });
});
