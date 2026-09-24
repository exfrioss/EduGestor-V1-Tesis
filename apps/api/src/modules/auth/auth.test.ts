import { describe, expect, it } from 'vitest';
import type { AuthConfig } from '../../config.js';
import { csrfCookieOptions, sessionCookieOptions } from './cookies.js';
import { createOpaqueSessionToken, hashSessionToken, tokensMatch } from './session-token.js';

const config: AuthConfig = {
  sessionTtlMs: 8 * 60 * 60 * 1_000,
  lastSeenIntervalMs: 5 * 60 * 1_000,
  sessionCookieName: 'edugestor_session',
  csrfCookieName: 'edugestor_csrf',
  secureCookies: true,
  loginRateLimitWindowMs: 15 * 60 * 1_000,
  loginRateLimitMaxAttempts: 5,
};

describe('fundaciones de sesión', () => {
  it('genera tokens opacos aleatorios y conserva sólo su hash determinista', () => {
    const first = createOpaqueSessionToken();
    const second = createOpaqueSessionToken();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(43);
    expect(hashSessionToken(first)).toHaveLength(64);
    expect(hashSessionToken(first)).not.toContain(first);
  });

  it('configura cookie de sesión HttpOnly, SameSite Lax y Secure en producción', () => {
    const expiresAt = new Date(Date.now() + config.sessionTtlMs);
    expect(sessionCookieOptions(config, expiresAt)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
    expect(csrfCookieOptions(config)).toMatchObject({
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
    });
  });

  it('compara tokens CSRF en tiempo constante cuando sus longitudes coinciden', () => {
    expect(tokensMatch('token-seguro', 'token-seguro')).toBe(true);
    expect(tokensMatch('token-seguro', 'token-distinto')).toBe(false);
    expect(tokensMatch('corto', 'mucho-mas-largo')).toBe(false);
  });
});
