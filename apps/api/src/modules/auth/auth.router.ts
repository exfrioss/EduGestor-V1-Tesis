import type { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { AuthConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import { authenticatedPrincipal, requireAuthenticated } from './auth.middleware.js';
import { AuthService } from './auth.service.js';
import { clearAuthenticationCookies, csrfCookieOptions, sessionCookieOptions } from './cookies.js';
import { createRequireCsrf } from './csrf.middleware.js';
import { createCsrfToken } from './session-token.js';

const loginSchema = z.object({
  login: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(1_000),
});

export const createAuthRouter = (client: PrismaClient, config: AuthConfig): Router => {
  const router = Router();
  const authService = new AuthService(client, config);
  const requireSession = requireAuthenticated(authService, config.sessionCookieName);
  const requireCsrf = createRequireCsrf(config);
  const loginLimiter = rateLimit({
    windowMs: config.loginRateLimitWindowMs,
    limit: config.loginRateLimitMaxAttempts,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: async (request, _response, next) => {
      await authService.auditRateLimitedLogin(String(_response.locals.requestId));
      next(new AppError(429, 'LOGIN_RATE_LIMITED', 'Demasiados intentos de inicio de sesión'));
    },
  });

  router.use((_request, response, next) => {
    response.setHeader('cache-control', 'no-store');
    next();
  });

  router.post('/login', loginLimiter, async (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Datos de autenticación inválidos');
    }

    const result = await authService.login(
      parsed.data.login,
      parsed.data.password,
      String(response.locals.requestId),
    );
    response.cookie(
      config.sessionCookieName,
      result.token,
      sessionCookieOptions(config, result.principal.expiresAt),
    );
    response.status(200).json({
      user: {
        id: result.principal.userId,
        login: result.principal.login,
        accountKind: result.principal.accountKind,
        teacher: result.principal.teacher,
      },
      session: { expiresAt: result.principal.expiresAt.toISOString() },
    });
  });

  router.get('/session', requireSession, (_request, response) => {
    const principal = authenticatedPrincipal(response.locals);
    response.status(200).json({
      user: {
        id: principal.userId,
        login: principal.login,
        accountKind: principal.accountKind,
        teacher: principal.teacher,
      },
      session: { expiresAt: principal.expiresAt.toISOString() },
    });
  });

  router.get('/csrf', requireSession, (_request, response) => {
    const csrfToken = createCsrfToken();
    response.cookie(config.csrfCookieName, csrfToken, csrfCookieOptions(config));
    response.status(200).json({ csrfToken });
  });

  router.post('/logout', requireSession, requireCsrf, async (_request, response) => {
    const principal = authenticatedPrincipal(response.locals);
    await authService.logout(principal, String(response.locals.requestId));
    clearAuthenticationCookies(response, config);
    response.status(204).send();
  });

  return router;
};
