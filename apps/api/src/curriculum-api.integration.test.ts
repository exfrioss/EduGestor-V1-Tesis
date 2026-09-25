import { randomUUID } from 'node:crypto';
import { AccountKind, PrismaClient, ScopeKind, type User } from '@prisma/client';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { AuthConfig } from './config.js';
import { createDatabaseProbe } from './database.js';
import { CurriculumService } from './modules/curriculum/curriculum.service.js';
import { DelegationService } from './modules/authorization/delegation.service.js';
import { PERMISSION_CATALOG, type PermissionCode } from './modules/authorization/permission-catalog.js';
import { createOpaqueSessionToken, hashSessionToken } from './modules/auth/session-token.js';

const describeDatabase = process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const client = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const config: AuthConfig = {
  sessionTtlMs: 28_800_000,
  lastSeenIntervalMs: 60_000,
  sessionCookieName: 'edugestor_session',
  csrfCookieName: 'edugestor_csrf',
  secureCookies: false,
  loginRateLimitWindowMs: 900_000,
  loginRateLimitMaxAttempts: 100,
};
const app = createApp(createDatabaseProbe(client), {
  logger: pino({ level: 'silent' }),
  auth: { client, config },
});

let technical: User;
let admin: User;
let courseAdmin: User;
let institutionId: string;
let otherInstitutionId: string;
let subjectId: string;
let otherSubjectId: string;
let courseId: string;
let roleId: string;
let technicalSession: string;
let adminSession: string;

const user = (label: string, kind = AccountKind.STANDARD) => client.user.create({
  data: { login: `${label}-${suffix}`, loginNormalized: `${label}-${suffix}`, passwordHash: 'integration-only', accountKind: kind },
});

const grant = async (
  grantor: User,
  recipient: User,
  scopeId: string,
  permissions: PermissionCode[],
) => {
  const assignment = await client.roleAssignment.create({
    data: { userId: recipient.id, roleId, scopeId, grantedById: grantor.id },
  });
  const catalog = await client.permission.findMany({ where: { code: { in: permissions } } });
  for (const permission of catalog) {
    await client.roleAssignmentPermission.create({
      data: {
        roleAssignmentId: assignment.id,
        permissionId: permission.id,
        delegatedById: grantor.id,
      },
    });
  }
  return assignment;
};

const session = async (actor: User) => {
  const token = createOpaqueSessionToken();
  await client.authSession.create({
    data: { userId: actor.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60_000) },
  });
  return `${config.sessionCookieName}=${token}`;
};

const csrf = async (cookie: string) => {
  const response = await request(app).get('/api/v1/auth/csrf').set('Cookie', cookie);
  const csrfCookie = (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
  return { token: response.body.csrfToken as string, cookie: `${cookie}; ${csrfCookie}` };
};

describeDatabase('API curricular y autorización con PostgreSQL real', () => {
  beforeAll(async () => {
    for (const permission of PERMISSION_CATALOG) {
      await client.permission.upsert({ where: { code: permission.code }, create: permission, update: permission });
    }
    [technical, admin, courseAdmin] = await Promise.all([
      user('curr-api-tech', AccountKind.TECHNICAL),
      user('curr-api-admin'),
      user('curr-api-course-admin'),
    ]);
    const [institution, otherInstitution] = await Promise.all([
      client.institution.create({ data: { name: `Curricular ${suffix}` } }),
      client.institution.create({ data: { name: `Curricular otra ${suffix}` } }),
    ]);
    institutionId = institution.id;
    otherInstitutionId = otherInstitution.id;
    const year = await client.academicYear.create({ data: { institutionId, label: `2026-${suffix}`, startsOn: new Date('2026-02-01'), endsOn: new Date('2026-11-30') } });
    const course = await client.course.create({ data: { institutionId, academicYearId: year.id, grade: '3.º', section: suffix, shift: 'Mañana', btiYear: 3 } });
    courseId = course.id;
    const [subject, otherSubject] = await Promise.all([
      client.subject.create({ data: { institutionId, name: `Diseño ${suffix}`, nameNormalized: `diseno-${suffix}` } }),
      client.subject.create({ data: { institutionId: otherInstitutionId, name: `Ajena ${suffix}`, nameNormalized: `ajena-${suffix}` } }),
    ]);
    subjectId = subject.id;
    otherSubjectId = otherSubject.id;
    const role = await client.role.create({ data: { code: `CURR-${suffix}`, name: 'Curricular' } });
    roleId = role.id;
    const [technicalScope, adminScope, courseScope] = await Promise.all([
      client.accessScope.create({ data: { institutionId, kind: ScopeKind.INSTITUTION, createdById: technical.id } }),
      client.accessScope.create({ data: { institutionId, kind: ScopeKind.INSTITUTION, createdById: technical.id } }),
      client.accessScope.create({ data: { institutionId, kind: ScopeKind.COURSE_SET, createdById: technical.id, courses: { create: { courseId } } } }),
    ]);
    await grant(technical, technical, technicalScope.id, ['curriculum-catalog.manage']);
    await grant(technical, admin, adminScope.id, [
      'curriculum-catalog.read',
      'curriculum-catalog.manage',
      'subject-curriculum-mapping.read',
      'subject-curriculum-mapping.manage',
      'administration.delegate',
    ]);
    await grant(technical, courseAdmin, courseScope.id, ['subject-curriculum-mapping.read', 'subject-curriculum-mapping.manage']);
    [technicalSession, adminSession] = await Promise.all([session(technical), session(admin)]);
  });

  afterAll(async () => client.$disconnect());

  it('sincroniza los 17 códigos sin conceder los cuatro nuevos al dataset Hito 1', async () => {
    expect(PERMISSION_CATALOG).toHaveLength(17);
    expect(await client.permission.count({ where: { code: { in: PERMISSION_CATALOG.map(({ code }) => code) } } })).toBe(17);
    const demoGrants = await client.roleAssignmentPermission.count({
      where: {
        assignment: { role: { code: 'HITO1_DEMO_INSTITUTION_ADMIN' } },
        permission: {
          code: {
            in: [
              'curriculum-catalog.read',
              'curriculum-catalog.manage',
              'subject-curriculum-mapping.read',
              'subject-curriculum-mapping.manage',
            ],
          },
        },
      },
    });
    expect(demoGrants).toBe(0);
  });

  it('exige sesión y CSRF para escritura técnica excepcional', async () => {
    expect((await request(app).post('/api/v1/curriculum/plan-types').send({})).status).toBe(401);
    expect((await request(app).post('/api/v1/curriculum/plan-types').set('Cookie', technicalSession).send({ code: `P-${suffix}`, name: 'Plan', technicalReason: 'Fuente oficial' })).status).toBe(403);
  });

  it('crea catálogo con cuenta técnica y rechaza al administrador ordinario aunque tenga el código', async () => {
    const technicalCsrf = await csrf(technicalSession);
    const created = await request(app).post('/api/v1/curriculum/plan-types').set('Cookie', technicalCsrf.cookie).set('x-csrf-token', technicalCsrf.token).send({ code: `OPT-${suffix}`, name: 'Plan Optativo', technicalReason: 'Resolución de prueba' });
    expect(created.status).toBe(201);
    const adminCsrf = await csrf(adminSession);
    const denied = await request(app).post('/api/v1/curriculum/plan-types').set('Cookie', adminCsrf.cookie).set('x-csrf-token', adminCsrf.token).send({ code: `BAD-${suffix}`, name: 'No permitido', technicalReason: 'Intento' });
    expect(denied.status).toBe(403);
    expect(await client.auditLog.count({ where: { actorUserId: admin.id, action: 'curriculum.plan-type.create', outcome: 'DENIED' } })).toBeGreaterThan(0);
  });

  it('no permite delegar curriculum-catalog.manage por el flujo ordinario', async () => {
    await expect(new DelegationService(client).delegate({ targetUserId: courseAdmin.id, roleId, scope: { kind: ScopeKind.INSTITUTION, institutionId }, permissions: ['curriculum-catalog.manage'] }, { actorUserId: admin.id, requestId: randomUUID() })).rejects.toMatchObject({ code: 'DELEGATION_DENIED' });
  });

  it('crea, lista, retira y sustituye correspondencias preservando UUID históricos', async () => {
    const service = new CurriculumService(client);
    const technicalContext = { actorUserId: technical.id, accountKind: technical.accountKind, requestId: randomUUID() };
    const adminContext = { actorUserId: admin.id, accountKind: admin.accountKind, requestId: randomUUID() };
    const plan = await client.planType.findFirstOrThrow({ where: { code: `OPT-${suffix}` } });
    const first = await service.createDiscipline({ planTypeId: plan.id, academicAreaId: null, code: `DG-${suffix}`, officialName: 'Diseño Gráfico', technicalReason: 'Clasificación oficial' }, technicalContext);
    const second = await service.createDiscipline({ planTypeId: plan.id, academicAreaId: null, code: `DG2-${suffix}`, officialName: 'Diseño Gráfico Avanzado', technicalReason: 'Clasificación oficial' }, technicalContext);
    const mapping = await service.createMapping(institutionId, subjectId, { btiYear: 3, curriculumDisciplineId: first.id }, adminContext);
    await expect(service.createMapping(institutionId, subjectId, { btiYear: 3, curriculumDisciplineId: first.id }, adminContext)).rejects.toMatchObject({ code: 'CURRENT_MAPPING_EXISTS' });
    const replacement = await service.replaceMapping(institutionId, subjectId, mapping.id, { curriculumDisciplineId: second.id, expectedVersion: mapping.rowVersion }, adminContext);
    expect(replacement.retiredMapping.id).toBe(mapping.id);
    expect(replacement.currentMapping.id).not.toBe(mapping.id);
    const retiredAgain = await service.retireMapping(institutionId, subjectId, replacement.currentMapping.id, { expectedVersion: replacement.currentMapping.rowVersion }, adminContext);
    const idempotent = await service.retireMapping(institutionId, subjectId, retiredAgain.id, { expectedVersion: retiredAgain.rowVersion }, adminContext);
    expect(idempotent.id).toBe(retiredAgain.id);
    expect(await client.subjectCurriculumMapping.count({ where: { subjectId, btiYear: 3 } })).toBe(2);
  });

  it('oculta UUID ajeno y bloquea escritura desde COURSE_SET', async () => {
    const service = new CurriculumService(client);
    const courseContext = { actorUserId: courseAdmin.id, accountKind: courseAdmin.accountKind, requestId: randomUUID() };
    await expect(service.listMappings(institutionId, otherSubjectId, { status: 'current', limit: 25 }, courseContext)).rejects.toMatchObject({ statusCode: 404 });
    const discipline = await client.curriculumDiscipline.findFirstOrThrow({ where: { code: `DG-${suffix}` } });
    await expect(service.createMapping(institutionId, subjectId, { btiYear: 1, curriculumDisciplineId: discipline.id }, courseContext)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('devuelve catálogo paginado sin curriculumAvailability y reautoriza el contexto', async () => {
    const response = await request(app).get(`/api/v1/curriculum/disciplines?institutionId=${institutionId}&limit=1`).set('Cookie', adminSession);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).not.toHaveProperty('curriculumAvailability');
    const denied = await request(app).get(`/api/v1/curriculum/disciplines?institutionId=${otherInstitutionId}`).set('Cookie', adminSession);
    expect(denied.status).toBe(403);
  });

  it('resuelve concurrencia de creación con exactamente una correspondencia vigente', async () => {
    const service = new CurriculumService(client);
    const context = { actorUserId: admin.id, accountKind: admin.accountKind, requestId: randomUUID() };
    const disciplines = await client.curriculumDiscipline.findMany({ where: { code: { in: [`DG-${suffix}`, `DG2-${suffix}`] } }, orderBy: { code: 'asc' } });
    const results = await Promise.allSettled(disciplines.map((discipline) => service.createMapping(institutionId, subjectId, { btiYear: 2, curriculumDisciplineId: discipline.id }, context)));
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(await client.subjectCurriculumMapping.count({ where: { subjectId, btiYear: 2, retiredAt: null } })).toBe(1);
  });

  it('accountKind TECHNICAL sin concesión explícita no habilita escritura compartida', async () => {
    const unprivileged = await user('curr-api-tech-no-grant', AccountKind.TECHNICAL);
    const service = new CurriculumService(client);
    await expect(service.createPlanType({ code: `NO-${suffix}`, name: 'No autorizado', technicalReason: 'Prueba negativa' }, { actorUserId: unprivileged.id, accountKind: unprivileged.accountKind, requestId: randomUUID() })).rejects.toMatchObject({ statusCode: 403 });
  });
});
