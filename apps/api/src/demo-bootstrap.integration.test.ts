import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { bootstrapHito1Demo } from './commands/bootstrap-hito1-demo.js';
import { HITO1_DEMO_IDS } from './commands/hito1-demo.constants.js';
import { bootstrapRoot } from './commands/bootstrap-root.js';
import { verifyPassword } from './security/password.js';

const describeDatabase = process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const client = new PrismaClient();
const password = randomBytes(24).toString('base64url');
const rootEnvironment = {
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  BOOTSTRAP_ROOT_LOGIN: 'integration.demo.technical',
  BOOTSTRAP_ROOT_PASSWORD: password,
  BOOTSTRAP_ROOT_REASON: 'Prueba de integración del bootstrap Hito 1',
};
const demoEnvironment = {
  NODE_ENV: 'test',
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  HITO1_DEMO_TECHNICAL_LOGIN: rootEnvironment.BOOTSTRAP_ROOT_LOGIN,
  HITO1_DEMO_ADMIN_LOGIN: 'integration.demo.admin',
  HITO1_DEMO_ADMIN_PASSWORD: password,
  HITO1_DEMO_TEACHER_ONE_LOGIN: 'integration.demo.teacher.one',
  HITO1_DEMO_TEACHER_ONE_PASSWORD: password,
  HITO1_DEMO_TEACHER_TWO_LOGIN: 'integration.demo.teacher.two',
  HITO1_DEMO_TEACHER_TWO_PASSWORD: password,
};

describeDatabase('bootstrap Hito 1 con PostgreSQL real', () => {
  it('crea el dataset completo, auditable y sin secretos', async () => {
    await bootstrapRoot(rootEnvironment);
    const result = await bootstrapHito1Demo(demoEnvironment);
    const [users, teachers, links, years, courses, subjects, assignments, grants, audits, admin] =
      await Promise.all([
        client.user.count({ where: { id: { in: [HITO1_DEMO_IDS.adminUser, HITO1_DEMO_IDS.teacherOneUser, HITO1_DEMO_IDS.teacherTwoUser] } } }),
        client.teacher.count({ where: { id: { in: [HITO1_DEMO_IDS.teacherOne, HITO1_DEMO_IDS.teacherTwo] } } }),
        client.teacherInstitution.count({ where: { id: { in: [HITO1_DEMO_IDS.teacherOneInstitution, HITO1_DEMO_IDS.teacherTwoInstitution] }, endedAt: null } }),
        client.academicYear.count({ where: { id: HITO1_DEMO_IDS.academicYear, isCurrent: true } }),
        client.course.count({ where: { id: HITO1_DEMO_IDS.course, isActive: true } }),
        client.subject.count({ where: { id: HITO1_DEMO_IDS.subject, isActive: true } }),
        client.teachingAssignment.count({ where: { id: { in: [HITO1_DEMO_IDS.teacherOneAssignment, HITO1_DEMO_IDS.teacherTwoAssignment] }, endedAt: null } }),
        client.roleAssignmentPermission.count({ where: { roleAssignmentId: HITO1_DEMO_IDS.administratorAssignment, revokedAt: null } }),
        client.auditLog.findMany({ where: { action: 'demo.hito1.bootstrap', institutionId: HITO1_DEMO_IDS.institution } }),
        client.user.findUniqueOrThrow({ where: { id: HITO1_DEMO_IDS.adminUser } }),
      ]);
    expect(result.permissions).toBe(13);
    expect({ users, teachers, links, years, courses, subjects, assignments, grants }).toEqual({ users: 3, teachers: 2, links: 2, years: 1, courses: 1, subjects: 1, assignments: 2, grants: 13 });
    expect(await verifyPassword(password, admin.passwordHash)).toBe(true);
    expect(audits.length).toBeGreaterThan(0);
    expect(JSON.stringify(audits)).not.toContain(password);
  });

  it('puede ejecutarse nuevamente sin duplicar datos de dominio', async () => {
    const before = await client.auditLog.count({ where: { action: 'demo.hito1.bootstrap', institutionId: HITO1_DEMO_IDS.institution } });
    await bootstrapHito1Demo(demoEnvironment);
    const [institutions, users, assignments, roleAssignments, after] = await Promise.all([
      client.institution.count({ where: { id: HITO1_DEMO_IDS.institution } }),
      client.user.count({ where: { id: { in: [HITO1_DEMO_IDS.adminUser, HITO1_DEMO_IDS.teacherOneUser, HITO1_DEMO_IDS.teacherTwoUser] } } }),
      client.teachingAssignment.count({ where: { id: { in: [HITO1_DEMO_IDS.teacherOneAssignment, HITO1_DEMO_IDS.teacherTwoAssignment] } } }),
      client.roleAssignment.count({ where: { id: HITO1_DEMO_IDS.administratorAssignment } }),
      client.auditLog.count({ where: { action: 'demo.hito1.bootstrap', institutionId: HITO1_DEMO_IDS.institution } }),
    ]);
    expect({ institutions, users, assignments, roleAssignments }).toEqual({ institutions: 1, users: 3, assignments: 2, roleAssignments: 1 });
    expect(after).toBe(before + 1);
  });
});

afterAll(async () => client.$disconnect());
