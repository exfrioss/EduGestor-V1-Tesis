import type { Request, RequestHandler } from 'express';
import { AppError } from '../../errors/app-error.js';
import { authenticatedPrincipal } from '../auth/auth.middleware.js';
import type { AuthorizationService } from './authorization.service.js';
import type { PermissionCode } from './permission-catalog.js';
import type { ResourceScope } from './scope.js';

export interface PermissionRequirement {
  permission: PermissionCode | ((request: Request) => PermissionCode);
  resolveScope(request: Request): Promise<ResourceScope>;
}

export const requirePermission = (
  authorization: AuthorizationService,
  requirement: PermissionRequirement,
): RequestHandler =>
  async (request, response, next) => {
    const principal = authenticatedPrincipal(response.locals);
    const permission =
      typeof requirement.permission === 'function'
        ? requirement.permission(request)
        : requirement.permission;
    const resource = await requirement.resolveScope(request);
    if (!(await authorization.isAuthorized(principal.userId, permission, resource))) {
      next(new AppError(403, 'PERMISSION_DENIED', 'Acceso denegado'));
      return;
    }
    next();
  };
