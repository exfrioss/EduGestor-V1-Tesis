import { ScopeKind, type PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import { authenticatedPrincipal, requireAuthenticated } from '../auth/auth.middleware.js';
import { AuthService } from '../auth/auth.service.js';
import { createRequireCsrf } from '../auth/csrf.middleware.js';
import { requirePermission } from './authorization.middleware.js';
import { AuthorizationService } from './authorization.service.js';
import { DelegationService } from './delegation.service.js';
import {
  isPermissionCode,
  PERMISSION_CODES,
  type PermissionCode,
} from './permission-catalog.js';
import {
  RESOURCE_TYPES,
  ResourceScopeResolver,
  type ResourceType,
} from './resource-scope-resolver.js';
import { TeachingAssignmentAuthorizationService } from './teaching-assignment-authorization.service.js';

const uuid = z.string().uuid();
const singleParam = (value: string | string[] | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined;
const grantSchema = z.object({
  targetUserId: uuid,
  roleId: uuid,
  scope: z.object({
    kind: z.enum(ScopeKind),
    institutionId: uuid,
    courseIds: z.array(uuid).max(500).optional(),
  }),
  permissions: z.array(z.enum(PERMISSION_CODES)).min(1).max(PERMISSION_CODES.length),
});

export const createAuthorizationRouter = (client: PrismaClient, config: AuthConfig): Router => {
  const router = Router();
  const authService = new AuthService(client, config);
  const authorization = new AuthorizationService(client);
  const delegation = new DelegationService(client);
  const resourceResolver = new ResourceScopeResolver(client);
  const teachingAssignments = new TeachingAssignmentAuthorizationService(client);
  const requireSession = requireAuthenticated(authService, config.sessionCookieName);
  const requireCsrf = createRequireCsrf(config);

  router.use(requireSession);
  router.use((_request, response, next) => {
    response.setHeader('cache-control', 'no-store');
    next();
  });

  router.get(
    '/check/:resourceType/:resourceId/:permissionCode',
    requirePermission(authorization, {
      permission(request) {
        const value = singleParam(request.params.permissionCode);
        if (value === undefined || !isPermissionCode(value)) {
          throw new AppError(400, 'UNKNOWN_PERMISSION', 'Permiso desconocido');
        }
        return value;
      },
      async resolveScope(request) {
        const resourceType = singleParam(request.params.resourceType);
        const resourceId = singleParam(request.params.resourceId);
        if (
          resourceType === undefined ||
          !RESOURCE_TYPES.includes(resourceType as ResourceType) ||
          resourceId === undefined ||
          !uuid.safeParse(resourceId).success
        ) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Referencia de recurso inválida');
        }
        return resourceResolver.resolve(resourceType as ResourceType, resourceId);
      },
    }),
    (_request, response) => response.status(200).json({ authorized: true }),
  );

  router.get('/teaching-assignments/:assignmentId/access', async (request, response) => {
    const assignmentId = singleParam(request.params.assignmentId);
    if (assignmentId === undefined || !uuid.safeParse(assignmentId).success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Asignación docente inválida');
    }
    const principal = authenticatedPrincipal(response.locals);
    if (!(await teachingAssignments.canAccessOwnAssignment(principal.userId, assignmentId))) {
      throw new AppError(403, 'TEACHING_ASSIGNMENT_ACCESS_DENIED', 'Acceso denegado');
    }
    response.status(200).json({ authorized: true });
  });

  router.post('/grants', requireCsrf, async (request, response) => {
    const parsed = grantSchema.safeParse(request.body);
    if (!parsed.success) {
      if (request.body?.scope?.kind === ScopeKind.RESOURCE_SET) {
        throw new AppError(
          400,
          'RESOURCE_SET_NOT_SUPPORTED',
          'RESOURCE_SET está fuera del alcance del Hito 1',
        );
      }
      throw new AppError(400, 'VALIDATION_ERROR', 'Concesión inválida');
    }
    const principal = authenticatedPrincipal(response.locals);
    const grant = await delegation.delegate(
      {
        ...parsed.data,
        permissions: parsed.data.permissions as PermissionCode[],
      },
      { actorUserId: principal.userId, requestId: String(response.locals.requestId) },
    );
    response.status(201).json({ grant });
  });

  router.post('/grants/:assignmentId/revoke', requireCsrf, async (request, response) => {
    const assignmentId = singleParam(request.params.assignmentId);
    if (assignmentId === undefined || !uuid.safeParse(assignmentId).success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Concesión inválida');
    }
    const principal = authenticatedPrincipal(response.locals);
    await delegation.revoke(assignmentId, {
      actorUserId: principal.userId,
      requestId: String(response.locals.requestId),
    });
    response.status(204).send();
  });

  return router;
};
