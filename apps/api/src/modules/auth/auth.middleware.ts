import type { RequestHandler } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { AuthenticatedPrincipal, AuthService } from './auth.service.js';

export const requireAuthenticated = (
  authService: AuthService,
  sessionCookieName: string,
): RequestHandler =>
  async (request, response, next) => {
    const token = request.cookies?.[sessionCookieName] as unknown;
    const principal = typeof token === 'string' ? await authService.authenticate(token) : null;
    if (principal === null) {
      next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Se requiere una sesión válida'));
      return;
    }
    response.locals.auth = principal;
    next();
  };

export const authenticatedPrincipal = (locals: Record<string, unknown>): AuthenticatedPrincipal => {
  const principal = locals.auth;
  if (principal === undefined) {
    throw new Error('requireAuthenticated debe ejecutarse antes de acceder a la sesión');
  }
  return principal as AuthenticatedPrincipal;
};
