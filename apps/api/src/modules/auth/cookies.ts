import type { CookieOptions, Response } from 'express';
import type { AuthConfig } from '../../config.js';

const sharedCookieOptions = (config: AuthConfig): CookieOptions => ({
  secure: config.secureCookies,
  sameSite: 'lax',
  path: '/',
});

export const sessionCookieOptions = (config: AuthConfig, expiresAt: Date): CookieOptions => ({
  ...sharedCookieOptions(config),
  httpOnly: true,
  expires: expiresAt,
});

export const csrfCookieOptions = (config: AuthConfig): CookieOptions => ({
  ...sharedCookieOptions(config),
  httpOnly: false,
});

export const clearAuthenticationCookies = (response: Response, config: AuthConfig): void => {
  response.clearCookie(config.sessionCookieName, {
    ...sharedCookieOptions(config),
    httpOnly: true,
  });
  response.clearCookie(config.csrfCookieName, {
    ...sharedCookieOptions(config),
    httpOnly: false,
  });
};
