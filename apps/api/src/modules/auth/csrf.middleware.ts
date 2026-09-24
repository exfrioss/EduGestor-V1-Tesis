import type { RequestHandler } from 'express';
import type { AuthConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import { tokensMatch } from './session-token.js';

export const createRequireCsrf = (config: AuthConfig): RequestHandler =>
  (request, _response, next) => {
    const cookieToken = request.cookies?.[config.csrfCookieName] as unknown;
    const headerToken = request.header('x-csrf-token');
    if (
      typeof cookieToken !== 'string' ||
      headerToken === undefined ||
      !tokensMatch(cookieToken, headerToken)
    ) {
      next(new AppError(403, 'CSRF_TOKEN_INVALID', 'Token CSRF ausente o inválido'));
      return;
    }
    next();
  };
