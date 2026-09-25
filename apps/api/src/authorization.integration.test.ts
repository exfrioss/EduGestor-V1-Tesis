import { randomUUID } from 'node:crypto';
import {
  AccountKind,
  PrismaClient,
  ScopeKind,
  type AccessScope,
  type Role,
  type User,
} from '@prisma/client';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { AuthConfig } from './config.js';
import { createDatabaseProbe } from './database.js';
import { AuthorizationService } from './modules/authorization/authorization.service.js';
import { DelegationService } from './modules/authorization/delegation.service.js';
import {
  PERMISSION_CATALOG,
  type PermissionCode,
} from './modules/authorization/permission-catalog.js';
import { TeachingAssignmentAuthorizationService } from './modules/authorization/teaching-assignment-authorization.service.js';
import { createOpaqueSessionToken, hashSessionToken } from './modules/auth/session-token.js';

const describeDatabase = process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const client = new PrismaClient();
const authorization = new AuthorizationService(client);
const delegation = new DelegationService(client);
const teacherAuthorization = new TeachingAssignmentAuthorizationService(client);
const suffix = randomUUID().slice(0, 8);
const requestId = () => randomUUID();

const config: AuthConfig = {
  sessionTtlMs: 8 * 60 * 60 * 1_000,
  lastSeenIntervalMs: 60_000,
  sessionCookieName: 'edugestor_session',
  csrfCookieName: 'edugestor_csrf',
  secureCookies: false,
  loginRateLimitWindowMs: 15 * 60 * 1_000,
  loginRateLimitMaxAttempts: 1_000,
};

const app = createApp(createDatabaseProbe(client), {
  logger: pino({ level: 'silent' }),
  auth: { client, config },
});

interface Fixture {
  technical: User;
  admin: User;
  limited: User;
  mixed: User;
  delegate: User;
  descendant: User;
  teacherA: User;
  teacherB: User;
  roleAdmin: Role;
  roleDelegate: Role;
  institutionA: { id: string };
  institutionB: { id: string };
  courseA1: { id: string; institutionId: string };
  courseA2: { id: string; institutionId: string };
  courseB1: { id: string; institutionId: string };
  assignmentA: { id: string };
  assignmentB: { id: string };
  adminScope: AccessScope;
  limitedScope: AccessScope;
  adminGrants: Map<PermissionCode, string>;
  limitedGrants: Map<PermissionCode, string>;
}

let fixture: Fixture;

const createUser = (name: string, accountKind = AccountKind.STANDARD) =>
  client.user.create({
    data: {
      login: `${name}-${suffix}`,
      loginNormalized: `${name}-${suffix}`,
      passwordHash: 'integration-only-not-a-password',
      accountKind,
    },
  });

const rootGrant = async (
  technical: User,
  user: User,
  role: Role,
  scope: AccessScope,
  permissions: PermissionCode[],
) => {
  const assignment = await client.roleAssignment.create({
    data: {
      userId: user.id,
      roleId: role.id,
      scopeId: scope.id,
      grantedById: technical.id,
    },
  });
  const catalog = await client.permission.findMany({ where: { code: { in: permissions } } });
  const grants = new Map<PermissionCode, string>();
  for (const permission of catalog) {
    const grant = await client.roleAssignmentPermission.create({
      data: {
        roleAssignmentId: assignment.id,
        permissionId: permission.id,
        delegatedById: technical.id,
      },
    });
    grants.set(permission.code as PermissionCode, grant.id);
  }
  return { assignment, grants };
};

const createScope = async (
  technical: User,
  institutionId: string,
  kind: ScopeKind,
  courseIds: string[] = [],
) =>
  client.accessScope.create({
    data: {
      institutionId,
      kind,
      createdById: technical.id,
      courses: courseIds.length === 0 ? undefined : { create: courseIds.map((courseId) => ({ courseId })) },
    },
  });

describeDatabase('motor de autorización jerárquica Hito 1 con PostgreSQL', () => {
  beforeAll(async () => {
    for (const permission of PERMISSION_CATALOG) {
      await client.permission.upsert({
        where: { code: permission.code },
        create: permission,
        update: { description: permission.description },
      });
    }
    const [technical, admin, limited, mixed, delegate, descendant, teacherA, teacherB] =
      await Promise.all([
        createUser('authz-technical', AccountKind.TECHNICAL),
        createUser('authz-admin'),
        createUser('authz-limited'),
        createUser('authz-mixed'),
        createUser('authz-delegate'),
        createUser('authz-descendant'),
        createUser('authz-teacher-a'),
        createUser('authz-teacher-b'),
      ]);
    const [roleAdmin, roleDelegate, roleMixedA, roleMixedB] = await Promise.all([
      client.role.create({ data: { code: `admin-${suffix}`, name: 'Administrador' } }),
      client.role.create({ data: { code: `delegate-${suffix}`, name: 'Delegado' } }),
      client.role.create({ data: { code: `mixed-a-${suffix}`, name: 'Rol mixto A' } }),
      client.role.create({ data: { code: `mixed-b-${suffix}`, name: 'Rol mixto B' } }),
    ]);
    const [institutionA, institutionB] = await Promise.all([
      client.institution.create({ data: { name: `Institución autorización A ${suffix}` } }),
      client.institution.create({ data: { name: `Institución autorización B ${suffix}` } }),
    ]);
    const [yearA, yearB] = await Promise.all([
      client.academicYear.create({
        data: {
          institutionId: institutionA.id,
          label: `2026-${suffix}`,
          startsOn: new Date('2026-02-01'),
          endsOn: new Date('2026-11-30'),
        },
      }),
      client.academicYear.create({
        data: {
          institutionId: institutionB.id,
          label: `2026-${suffix}`,
          startsOn: new Date('2026-02-01'),
          endsOn: new Date('2026-11-30'),
        },
      }),
    ]);
    const [courseA1, courseA2, courseB1] = await Promise.all([
      client.course.create({
        data: { institutionId: institutionA.id, academicYearId: yearA.id, grade: '1', section: `A-${suffix}`, shift: 'M' },
      }),
      client.course.create({
        data: { institutionId: institutionA.id, academicYearId: yearA.id, grade: '1', section: `B-${suffix}`, shift: 'M' },
      }),
      client.course.create({
        data: { institutionId: institutionB.id, academicYearId: yearB.id, grade: '1', section: `A-${suffix}`, shift: 'M' },
      }),
    ]);
    const [subjectA, subjectB] = await Promise.all([
      client.subject.create({
        data: { institutionId: institutionA.id, name: `Materia A ${suffix}`, nameNormalized: `materia-a-${suffix}` },
      }),
      client.subject.create({
        data: { institutionId: institutionA.id, name: `Materia B ${suffix}`, nameNormalized: `materia-b-${suffix}` },
      }),
    ]);
    const [teacherModelA, teacherModelB] = await Promise.all([
      client.teacher.create({ data: { userId: teacherA.id, displayName: `Docente A ${suffix}` } }),
      client.teacher.create({ data: { userId: teacherB.id, displayName: `Docente B ${suffix}` } }),
    ]);
    await Promise.all([
      client.teacherInstitution.create({ data: { teacherId: teacherModelA.id, institutionId: institutionA.id } }),
      client.teacherInstitution.create({ data: { teacherId: teacherModelB.id, institutionId: institutionA.id } }),
    ]);
    const [assignmentA, assignmentB] = await Promise.all([
      client.teachingAssignment.create({
        data: { teacherId: teacherModelA.id, institutionId: institutionA.id, courseId: courseA1.id, subjectId: subjectA.id },
      }),
      client.teachingAssignment.create({
        data: { teacherId: teacherModelB.id, institutionId: institutionA.id, courseId: courseA1.id, subjectId: subjectB.id },
      }),
    ]);

    const adminScope = await createScope(technical, institutionA.id, ScopeKind.INSTITUTION);
    const limitedScope = await createScope(technical, institutionA.id, ScopeKind.COURSE_SET, [courseA1.id]);
    const adminRoot = await rootGrant(
      technical,
      admin,
      roleAdmin,
      adminScope,
      PERMISSION_CATALOG.map(({ code }) => code),
    );
    const limitedRoot = await rootGrant(technical, limited, roleAdmin, limitedScope, [
      'course.read',
      'administration.delegate',
      'administration.revoke',
    ]);

    const mixedScopeA = await createScope(technical, institutionA.id, ScopeKind.COURSE_SET, [courseA1.id]);
    const mixedScopeB = await createScope(technical, institutionA.id, ScopeKind.COURSE_SET, [courseA2.id]);
    await rootGrant(technical, mixed, roleMixedA, mixedScopeA, ['course.read']);
    await rootGrant(technical, mixed, roleMixedB, mixedScopeB, ['subject.read']);

    fixture = {
      technical,
      admin,
      limited,
      mixed,
      delegate,
      descendant,
      teacherA,
      teacherB,
      roleAdmin,
      roleDelegate,
      institutionA,
      institutionB,
      courseA1,
      courseA2,
      courseB1,
      assignmentA,
      assignmentB,
      adminScope,
      limitedScope,
      adminGrants: adminRoot.grants,
      limitedGrants: limitedRoot.grants,
    };
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it('1. permite permiso correcto con scope correcto', async () => {
    await expect(
      authorization.isAuthorized(fixture.admin.id, 'course.read', {
        institutionId: fixture.institutionA.id,
        courseId: fixture.courseA1.id,
      }),
    ).resolves.toBe(true);
  });

  it('2. rechaza permiso correcto con scope incorrecto', async () => {
    await expect(
      authorization.isAuthorized(fixture.limited.id, 'course.read', {
        institutionId: fixture.institutionA.id,
        courseId: fixture.courseA2.id,
      }),
    ).resolves.toBe(false);
  });

  it('3. rechaza scope correcto con permiso incorrecto', async () => {
    await expect(
      authorization.isAuthorized(fixture.limited.id, 'course.manage', {
        institutionId: fixture.institutionA.id,
        courseId: fixture.courseA1.id,
      }),
    ).resolves.toBe(false);
  });

  it('4 y 13. no combina permiso y scope de concesiones o roles distintos', async () => {
    await expect(
      authorization.isAuthorized(fixture.mixed.id, 'course.read', {
        institutionId: fixture.institutionA.id,
        courseId: fixture.courseA2.id,
      }),
    ).resolves.toBe(false);
  });

  it('5. permite al administrador institucional dentro de su institución', async () => {
    await expect(
      authorization.isAuthorized(fixture.admin.id, 'course.manage', {
        institutionId: fixture.institutionA.id,
        courseId: fixture.courseA2.id,
      }),
    ).resolves.toBe(true);
    await expect(
      authorization.isAuthorized(fixture.admin.id, 'course.manage', {
        institutionId: fixture.institutionB.id,
        courseId: fixture.courseB1.id,
      }),
    ).resolves.toBe(false);
  });

  it('6. rechaza al administrador limitado fuera de su curso', async () => {
    await expect(
      authorization.isAuthorized(fixture.limited.id, 'course.read', {
        institutionId: fixture.institutionA.id,
        courseId: fixture.courseA2.id,
      }),
    ).resolves.toBe(false);
  });

  it('7. permite delegación válida a un scope menor y conserva parentGrantId', async () => {
    const grant = await delegation.delegate(
      {
        targetUserId: fixture.delegate.id,
        roleId: fixture.roleDelegate.id,
        scope: {
          kind: ScopeKind.COURSE_SET,
          institutionId: fixture.institutionA.id,
          courseIds: [fixture.courseA1.id],
        },
        permissions: ['course.read', 'administration.delegate'],
      },
      { actorUserId: fixture.admin.id, requestId: requestId() },
    );
    const stored = await client.roleAssignmentPermission.findMany({
      where: { roleAssignmentId: grant.id },
    });
    expect(stored).toHaveLength(2);
    expect(stored.every(({ parentGrantId }) => parentGrantId !== null)).toBe(true);
    await expect(
      authorization.isAuthorized(fixture.delegate.id, 'course.read', {
        institutionId: fixture.institutionA.id,
        courseId: fixture.courseA1.id,
      }),
    ).resolves.toBe(true);
  });

  it('8. rechaza delegación de un permiso superior al propio', async () => {
    await expect(
      delegation.delegate(
        {
          targetUserId: fixture.descendant.id,
          roleId: fixture.roleDelegate.id,
          scope: {
            kind: ScopeKind.COURSE_SET,
            institutionId: fixture.institutionA.id,
            courseIds: [fixture.courseA1.id],
          },
          permissions: ['subject.manage'],
        },
        { actorUserId: fixture.limited.id, requestId: requestId() },
      ),
    ).rejects.toMatchObject({ code: 'DELEGATION_DENIED' });
  });

  it('9. rechaza delegación de un scope superior al propio', async () => {
    await expect(
      delegation.delegate(
        {
          targetUserId: fixture.descendant.id,
          roleId: fixture.roleDelegate.id,
          scope: {
            kind: ScopeKind.COURSE_SET,
            institutionId: fixture.institutionA.id,
            courseIds: [fixture.courseA1.id, fixture.courseA2.id],
          },
          permissions: ['course.read'],
        },
        { actorUserId: fixture.limited.id, requestId: requestId() },
      ),
    ).rejects.toMatchObject({ code: 'DELEGATION_DENIED' });
  });

  it('10. rechaza autoelevación', async () => {
    await expect(
      delegation.delegate(
        {
          targetUserId: fixture.admin.id,
          roleId: fixture.roleDelegate.id,
          scope: { kind: ScopeKind.INSTITUTION, institutionId: fixture.institutionA.id },
          permissions: ['course.read'],
        },
        { actorUserId: fixture.admin.id, requestId: requestId() },
      ),
    ).rejects.toMatchObject({ code: 'DELEGATION_DENIED' });
  });

  it('11. rechaza ciclos y mutación de la procedencia', async () => {
    const parentGrantId = fixture.adminGrants.get('course.read');
    const child = await client.roleAssignmentPermission.findFirstOrThrow({
      where: { delegatedById: fixture.admin.id, permission: { code: 'course.read' } },
    });
    await expect(
      client.roleAssignmentPermission.update({
        where: { id: parentGrantId },
        data: { parentGrantId: child.id },
      }),
    ).rejects.toThrow();
  });

  it('12. una concesión revocada y sus descendientes dejan de autorizar', async () => {
    const delegateAssignment = await client.roleAssignment.findFirstOrThrow({
      where: { userId: fixture.delegate.id, revokedAt: null },
      include: { scope: true },
    });
    const descendantGrant = await delegation.delegate(
      {
        targetUserId: fixture.descendant.id,
        roleId: fixture.roleDelegate.id,
        scope: {
          kind: ScopeKind.COURSE_SET,
          institutionId: fixture.institutionA.id,
          courseIds: [fixture.courseA1.id],
        },
        permissions: ['course.read'],
      },
      { actorUserId: fixture.delegate.id, requestId: requestId() },
    );
    await expect(
      authorization.isAuthorized(fixture.descendant.id, 'course.read', {
        institutionId: fixture.institutionA.id,
        courseId: fixture.courseA1.id,
      }),
    ).resolves.toBe(true);

    await delegation.revoke(delegateAssignment.id, {
      actorUserId: fixture.admin.id,
      requestId: requestId(),
    });
    await expect(
      authorization.isAuthorized(fixture.delegate.id, 'course.read', {
        institutionId: fixture.institutionA.id,
        courseId: fixture.courseA1.id,
      }),
    ).resolves.toBe(false);
    await expect(
      authorization.isAuthorized(fixture.descendant.id, 'course.read', {
        institutionId: fixture.institutionA.id,
        courseId: fixture.courseA1.id,
      }),
    ).resolves.toBe(false);
    expect(
      (await client.roleAssignment.findUniqueOrThrow({ where: { id: descendantGrant.id } })).revokedAt,
    ).not.toBeNull();
  });

  it('14. Docente A no accede a la TeachingAssignment de Docente B', async () => {
    await expect(
      teacherAuthorization.canAccessOwnAssignment(fixture.teacherA.id, fixture.assignmentA.id),
    ).resolves.toBe(true);
    await expect(
      teacherAuthorization.canAccessOwnAssignment(fixture.teacherA.id, fixture.assignmentB.id),
    ).resolves.toBe(false);
  });

  it('15. audita concesiones exitosas y rechazadas sin secretos', async () => {
    const events = await client.auditLog.findMany({
      where: {
        actorUserId: { in: [fixture.admin.id, fixture.limited.id] },
        action: { in: ['authorization.grant', 'authorization.revoke'] },
      },
    });
    expect(events.some(({ outcome }) => outcome === 'SUCCESS')).toBe(true);
    expect(events.some(({ outcome }) => outcome === 'DENIED')).toBe(true);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toMatch(/passwordHash|sessionToken|tokenHash|cookie/i);
  });

  it('rechaza RESOURCE_SET explícitamente', async () => {
    await expect(
      delegation.delegate(
        {
          targetUserId: fixture.descendant.id,
          roleId: fixture.roleDelegate.id,
          scope: { kind: ScopeKind.RESOURCE_SET, institutionId: fixture.institutionA.id },
          permissions: ['course.read'],
        },
        { actorUserId: fixture.admin.id, requestId: requestId() },
      ),
    ).rejects.toMatchObject({ code: 'RESOURCE_SET_NOT_SUPPORTED' });
  });

  it('aplica requirePermission y aislamiento docente en las rutas de comprobación', async () => {
    const [adminToken, teacherToken] = [createOpaqueSessionToken(), createOpaqueSessionToken()];
    await client.authSession.createMany({
      data: [
        {
          userId: fixture.admin.id,
          tokenHash: hashSessionToken(adminToken),
          expiresAt: new Date(Date.now() + 60_000),
        },
        {
          userId: fixture.teacherA.id,
          tokenHash: hashSessionToken(teacherToken),
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    });
    const allowed = await request(app)
      .get(`/api/v1/authorization/check/course/${fixture.courseA1.id}/course.read`)
      .set('Cookie', `${config.sessionCookieName}=${adminToken}`);
    const denied = await request(app)
      .get(`/api/v1/authorization/check/course/${fixture.courseB1.id}/course.read`)
      .set('Cookie', `${config.sessionCookieName}=${adminToken}`);
    const own = await request(app)
      .get(`/api/v1/authorization/teaching-assignments/${fixture.assignmentA.id}/access`)
      .set('Cookie', `${config.sessionCookieName}=${teacherToken}`);
    const foreign = await request(app)
      .get(`/api/v1/authorization/teaching-assignments/${fixture.assignmentB.id}/access`)
      .set('Cookie', `${config.sessionCookieName}=${teacherToken}`);

    expect(allowed.status).toBe(200);
    expect(denied.status).toBe(403);
    expect(own.status).toBe(200);
    expect(foreign.status).toBe(403);
    expect(foreign.body.error).not.toHaveProperty('assignment');
  });
});
