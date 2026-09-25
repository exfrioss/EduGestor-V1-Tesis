import {
  AccountKind,
  AuditActorKind,
  AuditOutcome,
  Prisma,
  type PrismaClient,
  ScopeKind,
} from '@prisma/client';
import { AppError } from '../../errors/app-error.js';
import { AuthorizationService } from './authorization.service.js';
import type { PermissionCode } from './permission-catalog.js';
import type { ScopeSnapshot } from './scope.js';

export interface RequestedScope {
  kind: ScopeKind;
  institutionId: string;
  courseIds?: string[];
}

export interface DelegateGrantInput {
  targetUserId: string;
  roleId: string;
  scope: RequestedScope;
  permissions: PermissionCode[];
}

interface OperationContext {
  actorUserId: string;
  requestId: string;
}

const denied = (message: string) => new AppError(403, 'DELEGATION_DENIED', message);

export class DelegationService {
  constructor(private readonly client: PrismaClient) {}

  async delegate(input: DelegateGrantInput, context: OperationContext) {
    try {
      return await this.serializableTransaction(
        async (transaction) => {
          if (input.targetUserId === context.actorUserId) {
            throw denied('No se permite la autodelegación');
          }
          const targetScope = await this.validateRequestedScope(transaction, input.scope);
          const uniquePermissions = [...new Set(input.permissions)];
          if (uniquePermissions.length === 0) {
            throw new AppError(400, 'VALIDATION_ERROR', 'Debe indicarse al menos un permiso');
          }

          const [targetUser, role, permissions] = await Promise.all([
            transaction.user.findUnique({
              where: { id: input.targetUserId },
              select: { id: true, isActive: true },
            }),
            transaction.role.findUnique({ where: { id: input.roleId }, select: { id: true } }),
            transaction.permission.findMany({
              where: { code: { in: uniquePermissions } },
              select: { id: true, code: true },
            }),
          ]);
          if (targetUser === null || !targetUser.isActive || role === null) {
            throw new AppError(400, 'INVALID_GRANT_TARGET', 'Destino de concesión inválido');
          }
          if (permissions.length !== uniquePermissions.length) {
            throw new AppError(400, 'UNKNOWN_PERMISSION', 'El catálogo no contiene un permiso solicitado');
          }

          const authorization = new AuthorizationService(transaction);
          const canDelegate = await authorization.findGrantContainingScope(
            context.actorUserId,
            'administration.delegate',
            targetScope,
          );
          if (canDelegate === null) {
            throw denied('El administrador no puede delegar dentro del ámbito solicitado');
          }

          const parentByCode = new Map<PermissionCode, string>();
          for (const permissionCode of uniquePermissions) {
            const parentGrantId = await authorization.findGrantContainingScope(
              context.actorUserId,
              permissionCode,
              targetScope,
            );
            if (parentGrantId === null) {
              throw denied('No se puede delegar un permiso o ámbito superior al propio');
            }
            parentByCode.set(permissionCode, parentGrantId);
          }

          const scope = await transaction.accessScope.create({
            data: {
              kind: targetScope.kind,
              institutionId: targetScope.institutionId,
              createdById: context.actorUserId,
              courses:
                targetScope.kind === ScopeKind.COURSE_SET
                  ? { create: [...targetScope.courseIds].map((courseId) => ({ courseId })) }
                  : undefined,
            },
          });
          const assignment = await transaction.roleAssignment.create({
            data: {
              userId: input.targetUserId,
              roleId: input.roleId,
              scopeId: scope.id,
              grantedById: context.actorUserId,
            },
          });
          await transaction.roleAssignmentPermission.createMany({
            data: permissions.map((permission) => ({
              roleAssignmentId: assignment.id,
              permissionId: permission.id,
              parentGrantId: parentByCode.get(permission.code as PermissionCode),
              delegatedById: context.actorUserId,
            })),
          });
          await this.appendAudit(transaction, context, {
            action: 'authorization.grant',
            outcome: AuditOutcome.SUCCESS,
            entityId: assignment.id,
            institutionId: targetScope.institutionId,
            details: {
              targetUserId: input.targetUserId,
              roleId: input.roleId,
              scopeKind: targetScope.kind,
              courseIds: [...targetScope.courseIds],
              permissions: uniquePermissions,
            },
          });

          return {
            id: assignment.id,
            userId: assignment.userId,
            roleId: assignment.roleId,
            scope: {
              kind: targetScope.kind,
              institutionId: targetScope.institutionId,
              courseIds: [...targetScope.courseIds],
            },
            permissions: uniquePermissions,
          };
        },
      );
    } catch (error) {
      if (error instanceof AppError) {
        await this.appendDeniedAudit(context, 'authorization.grant', error.message, {
          targetUserId: input.targetUserId,
          roleId: input.roleId,
          scopeKind: input.scope.kind,
          institutionId: input.scope.institutionId,
          permissions: input.permissions,
        });
      }
      throw error;
    }
  }

  async revoke(assignmentId: string, context: OperationContext): Promise<void> {
    try {
      await this.serializableTransaction(
        async (transaction) => {
          const assignment = await transaction.roleAssignment.findUnique({
            where: { id: assignmentId },
            include: {
              scope: { include: { courses: { select: { courseId: true } } } },
            },
          });
          if (assignment === null || assignment.revokedAt !== null) {
            throw new AppError(404, 'GRANT_NOT_FOUND', 'Concesión no encontrada');
          }
          const targetScope: ScopeSnapshot = {
            id: assignment.scope.id,
            kind: assignment.scope.kind,
            institutionId: assignment.scope.institutionId,
            courseIds: new Set(assignment.scope.courses.map(({ courseId }) => courseId)),
          };
          const authorization = new AuthorizationService(transaction);
          if (
            (await authorization.findGrantContainingScope(
              context.actorUserId,
              'administration.revoke',
              targetScope,
            )) === null
          ) {
            throw denied('No se puede revocar una concesión fuera del ámbito propio');
          }

          const grants = await transaction.roleAssignmentPermission.findMany({
            select: { id: true, parentGrantId: true, roleAssignmentId: true, revokedAt: true },
          });
          const descendants = new Set(
            grants.filter((grant) => grant.roleAssignmentId === assignmentId).map(({ id }) => id),
          );
          let changed = true;
          while (changed) {
            changed = false;
            for (const grant of grants) {
              if (
                grant.parentGrantId !== null &&
                descendants.has(grant.parentGrantId) &&
                !descendants.has(grant.id)
              ) {
                descendants.add(grant.id);
                changed = true;
              }
            }
          }

          const now = new Date();
          await transaction.roleAssignmentPermission.updateMany({
            where: { id: { in: [...descendants] }, revokedAt: null },
            data: { revokedAt: now, rowVersion: { increment: 1 } },
          });
          await transaction.roleAssignment.update({
            where: { id: assignmentId },
            data: {
              revokedAt: now,
              revokedById: context.actorUserId,
              rowVersion: { increment: 1 },
            },
          });

          const descendantAssignmentIds = [
            ...new Set(
              grants
                .filter((grant) => descendants.has(grant.id))
                .map(({ roleAssignmentId }) => roleAssignmentId),
            ),
          ].filter((id) => id !== assignmentId);
          for (const descendantAssignmentId of descendantAssignmentIds) {
            const remaining = await transaction.roleAssignmentPermission.count({
              where: { roleAssignmentId: descendantAssignmentId, revokedAt: null },
            });
            if (remaining === 0) {
              await transaction.roleAssignment.updateMany({
                where: { id: descendantAssignmentId, revokedAt: null },
                data: {
                  revokedAt: now,
                  revokedById: context.actorUserId,
                  rowVersion: { increment: 1 },
                },
              });
            }
          }

          await this.appendAudit(transaction, context, {
            action: 'authorization.revoke',
            outcome: AuditOutcome.SUCCESS,
            entityId: assignmentId,
            institutionId: targetScope.institutionId,
            details: {
              descendantPermissionGrantsRevoked: descendants.size,
              descendantAssignmentsAffected: descendantAssignmentIds.length,
            },
          });
        },
      );
    } catch (error) {
      if (error instanceof AppError) {
        await this.appendDeniedAudit(context, 'authorization.revoke', error.message, { assignmentId });
      }
      throw error;
    }
  }

  private async validateRequestedScope(
    transaction: Prisma.TransactionClient,
    requested: RequestedScope,
  ): Promise<ScopeSnapshot> {
    if (requested.kind === ScopeKind.RESOURCE_SET) {
      throw new AppError(
        400,
        'RESOURCE_SET_NOT_SUPPORTED',
        'RESOURCE_SET está fuera del alcance del Hito 1',
      );
    }
    const institution = await transaction.institution.findUnique({
      where: { id: requested.institutionId },
      select: { isActive: true },
    });
    if (institution === null || !institution.isActive) {
      throw new AppError(400, 'INVALID_SCOPE', 'La institución del ámbito no está disponible');
    }
    const courseIds = new Set(requested.courseIds ?? []);
    if (requested.kind === ScopeKind.INSTITUTION && courseIds.size > 0) {
      throw new AppError(400, 'INVALID_SCOPE', 'Un ámbito institucional no admite cursos');
    }
    if (requested.kind === ScopeKind.COURSE_SET) {
      if (courseIds.size === 0) {
        throw new AppError(400, 'INVALID_SCOPE', 'COURSE_SET requiere al menos un curso');
      }
      const count = await transaction.course.count({
        where: {
          id: { in: [...courseIds] },
          institutionId: requested.institutionId,
          isActive: true,
        },
      });
      if (count !== courseIds.size) {
        throw new AppError(400, 'INVALID_SCOPE', 'Los cursos no pertenecen a la institución');
      }
    }
    return {
      kind: requested.kind,
      institutionId: requested.institutionId,
      courseIds,
    };
  }

  private async appendDeniedAudit(
    context: OperationContext,
    action: string,
    reason: string,
    details: Prisma.InputJsonObject,
  ) {
    const actor = await this.client.user.findUniqueOrThrow({
      where: { id: context.actorUserId },
      select: { accountKind: true },
    });
    await this.client.auditLog.create({
      data: {
        actorUserId: context.actorUserId,
        actorKind:
          actor.accountKind === AccountKind.TECHNICAL
            ? AuditActorKind.TECHNICAL
            : AuditActorKind.USER,
        action,
        entityType: 'RoleAssignment',
        outcome: AuditOutcome.DENIED,
        requestId: context.requestId,
        reason,
        details,
      },
    });
  }

  private async serializableTransaction<T>(
    work: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.client.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2034' ||
          attempt === 3
        ) {
          throw error;
        }
      }
    }
    throw new Error('No se pudo completar la transacción serializable');
  }

  private async appendAudit(
    transaction: Prisma.TransactionClient,
    context: OperationContext,
    event: {
      action: string;
      outcome: AuditOutcome;
      entityId: string;
      institutionId: string;
      details: Prisma.InputJsonValue;
    },
  ) {
    const actor = await transaction.user.findUniqueOrThrow({
      where: { id: context.actorUserId },
      select: { accountKind: true },
    });
    await transaction.auditLog.create({
      data: {
        actorUserId: context.actorUserId,
        actorKind:
          actor.accountKind === AccountKind.TECHNICAL
            ? AuditActorKind.TECHNICAL
            : AuditActorKind.USER,
        action: event.action,
        entityType: 'RoleAssignment',
        entityId: event.entityId,
        institutionId: event.institutionId,
        outcome: event.outcome,
        requestId: context.requestId,
        reason:
          actor.accountKind === AccountKind.TECHNICAL
            ? 'Operación excepcional de cuenta técnica'
            : undefined,
        details: event.details,
      },
    });
  }
}
