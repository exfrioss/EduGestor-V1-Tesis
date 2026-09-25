import { AccountKind, type Prisma, type PrismaClient } from '@prisma/client';
import type { PermissionCode } from './permission-catalog.js';
import {
  scopeContainsResource,
  scopeContainsScope,
  scopeFromRecord,
  type ResourceScope,
  type ScopeSnapshot,
} from './scope.js';

type AuthorizationStore = Pick<PrismaClient, 'roleAssignmentPermission' | 'user'>;

const grantInclude = {
  permission: { select: { id: true, code: true } },
  delegatedBy: { select: { id: true, accountKind: true, isActive: true } },
  assignment: {
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      user: { select: { isActive: true } },
      scope: {
        select: {
          id: true,
          kind: true,
          institutionId: true,
          courses: { select: { courseId: true } },
        },
      },
    },
  },
} as const;
type GrantRecord = Prisma.RoleAssignmentPermissionGetPayload<{ include: typeof grantInclude }>;

export class AuthorizationService {
  constructor(private readonly store: AuthorizationStore) {}

  async isAuthorized(
    userId: string,
    permissionCode: PermissionCode,
    resource: ResourceScope,
  ): Promise<boolean> {
    if (permissionCode === 'curriculum-catalog.manage') {
      return this.hasEffectiveTechnicalRootGrant(userId, permissionCode);
    }
    const grant = await this.findGrantForResource(userId, permissionCode, resource);
    return grant !== null;
  }

  async findGrantContainingScope(
    userId: string,
    permissionCode: PermissionCode,
    targetScope: ScopeSnapshot,
  ): Promise<string | null> {
    const candidates = await this.activeCandidates(userId, permissionCode);
    for (const candidate of candidates) {
      if (
        scopeContainsScope(scopeFromRecord(candidate.assignment.scope), targetScope) &&
        (await this.isGrantChainEffective(candidate.id, userId, permissionCode))
      ) {
        return candidate.id;
      }
    }
    return null;
  }

  async hasEffectiveTechnicalRootGrant(
    userId: string,
    permissionCode: PermissionCode,
  ): Promise<boolean> {
    const actor = await this.store.user.findUnique({
      where: { id: userId },
      select: { accountKind: true, isActive: true },
    });
    if (actor?.accountKind !== AccountKind.TECHNICAL || !actor.isActive) return false;

    const candidates = await this.activeCandidates(userId, permissionCode);
    for (const candidate of candidates) {
      if (
        candidate.parentGrantId === null &&
        candidate.delegatedById === userId &&
        (await this.isGrantChainEffective(candidate.id, userId, permissionCode))
      ) {
        return true;
      }
    }
    return false;
  }

  async hasEffectiveGrantInInstitution(
    userId: string,
    permissionCode: PermissionCode,
    institutionId: string,
  ): Promise<boolean> {
    const candidates = await this.activeCandidates(userId, permissionCode);
    for (const candidate of candidates) {
      const scope = scopeFromRecord(candidate.assignment.scope);
      if (
        scope.institutionId === institutionId &&
        scope.kind !== 'RESOURCE_SET' &&
        (await this.isGrantChainEffective(candidate.id, userId, permissionCode))
      ) return true;
    }
    return false;
  }

  async hasAnyEffectiveGrant(userId: string, permissionCode: PermissionCode): Promise<boolean> {
    const candidates = await this.activeCandidates(userId, permissionCode);
    for (const candidate of candidates) {
      if (await this.isGrantChainEffective(candidate.id, userId, permissionCode)) return true;
    }
    return false;
  }

  private async findGrantForResource(
    userId: string,
    permissionCode: PermissionCode,
    resource: ResourceScope,
  ): Promise<string | null> {
    const candidates = await this.activeCandidates(userId, permissionCode);
    for (const candidate of candidates) {
      if (
        scopeContainsResource(scopeFromRecord(candidate.assignment.scope), resource) &&
        (await this.isGrantChainEffective(candidate.id, userId, permissionCode))
      ) {
        return candidate.id;
      }
    }
    return null;
  }

  private activeCandidates(userId: string, permissionCode: PermissionCode) {
    return this.store.roleAssignmentPermission.findMany({
      where: {
        revokedAt: null,
        permission: { code: permissionCode },
        assignment: { userId, revokedAt: null, user: { isActive: true } },
      },
      include: grantInclude,
    });
  }

  private async isGrantChainEffective(
    initialGrantId: string,
    expectedUserId: string,
    permissionCode: PermissionCode,
  ): Promise<boolean> {
    const visited = new Set<string>();
    let currentId: string | null = initialGrantId;
    let childScope: ScopeSnapshot | null = null;
    let childDelegatedById: string | null = null;
    let first = true;

    while (currentId !== null) {
      if (visited.has(currentId)) return false;
      visited.add(currentId);

      const grant: GrantRecord | null = await this.store.roleAssignmentPermission.findUnique({
        where: { id: currentId },
        include: grantInclude,
      });
      if (
        grant === null ||
        grant.revokedAt !== null ||
        grant.assignment.revokedAt !== null ||
        !grant.assignment.user.isActive ||
        grant.permission.code !== permissionCode ||
        (first && grant.assignment.userId !== expectedUserId)
      ) {
        return false;
      }

      const currentScope = scopeFromRecord(grant.assignment.scope);
      if (
        childScope !== null &&
        (!scopeContainsScope(currentScope, childScope) ||
          childDelegatedById !== grant.assignment.userId)
      ) {
        return false;
      }

      if (grant.parentGrantId === null) {
        return grant.delegatedBy.accountKind === AccountKind.TECHNICAL && grant.delegatedBy.isActive;
      }

      childScope = currentScope;
      childDelegatedById = grant.delegatedById;
      currentId = grant.parentGrantId;
      first = false;
    }
    return false;
  }
}
