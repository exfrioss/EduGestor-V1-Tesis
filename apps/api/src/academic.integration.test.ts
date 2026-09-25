import { randomUUID } from 'node:crypto';
import { AccountKind, PrismaClient, ScopeKind, type User } from '@prisma/client';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { AuthConfig } from './config.js';
import { createDatabaseProbe } from './database.js';
import { AcademicService } from './modules/academic/academic.service.js';
import type { OperationContext } from './modules/academic/academic.types.js';
import { PERMISSION_CATALOG } from './modules/authorization/permission-catalog.js';
import { createOpaqueSessionToken, hashSessionToken } from './modules/auth/session-token.js';

const describeDatabase = process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const client = new PrismaClient();
const service = new AcademicService(client);
const suffix = randomUUID().slice(0, 8);

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

const operationContext = (user: User): OperationContext => ({
  actorUserId: user.id,
  accountKind: user.accountKind,
  requestId: randomUUID(),
});

let technical: User;
let admin: User;
let institutionA: Awaited<ReturnType<AcademicService['createInstitution']>>;
let institutionB: Awaited<ReturnType<AcademicService['createInstitution']>>;
let teacherA: Awaited<ReturnType<AcademicService['createTeacher']>>;
let teacherB: Awaited<ReturnType<AcademicService['createTeacher']>>;
let crossTeacher: { id: string };
let yearA: Awaited<ReturnType<AcademicService['createAcademicYear']>>;
let yearB: { id: string };
let courseA: Awaited<ReturnType<AcademicService['createCourse']>>;
let courseB: { id: string };
let subjectA: Awaited<ReturnType<AcademicService['createSubject']>>;
let subjectA2: Awaited<ReturnType<AcademicService['createSubject']>>;
let subjectB: { id: string };
let assignmentA: Awaited<ReturnType<AcademicService['createTeachingAssignment']>>;
let assignmentB: Awaited<ReturnType<AcademicService['createTeachingAssignment']>>;

describeDatabase('núcleo institucional y académico Hito 1 con PostgreSQL', () => {
  beforeAll(async () => {
    for (const permission of PERMISSION_CATALOG) {
      await client.permission.upsert({
        where: { code: permission.code },
        create: permission,
        update: { description: permission.description },
      });
    }
    technical = await client.user.create({
      data: {
        login: `academic-technical-${suffix}`,
        loginNormalized: `academic-technical-${suffix}`,
        passwordHash: 'integration-only',
        accountKind: AccountKind.TECHNICAL,
      },
    });
    admin = await client.user.create({
      data: {
        login: `academic-admin-${suffix}`,
        loginNormalized: `academic-admin-${suffix}`,
        passwordHash: 'integration-only',
      },
    });
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it('1. crea instituciones por la operación técnica autorizada y establece scope explícito', async () => {
    institutionA = await service.createInstitution(
      { name: `Institución Académica A ${suffix}`, technicalReason: 'Bootstrap de integración' },
      operationContext(technical),
    );
    institutionB = await service.createInstitution(
      { name: `Institución Académica B ${suffix}`, technicalReason: 'Bootstrap de integración' },
      operationContext(technical),
    );
    const role = await client.role.create({
      data: { code: `academic-admin-${suffix}`, name: 'Administrador académico' },
    });
    const scope = await client.accessScope.create({
      data: {
        institutionId: institutionA.id,
        createdById: technical.id,
        kind: ScopeKind.INSTITUTION,
      },
    });
    const roleAssignment = await client.roleAssignment.create({
      data: {
        userId: admin.id,
        roleId: role.id,
        scopeId: scope.id,
        grantedById: technical.id,
      },
    });
    const permissions = await client.permission.findMany({
      where: { code: { in: PERMISSION_CATALOG.map(({ code }) => code) } },
    });
    await client.roleAssignmentPermission.createMany({
      data: permissions.map((permission) => ({
        roleAssignmentId: roleAssignment.id,
        permissionId: permission.id,
        delegatedById: technical.id,
      })),
    });

    await expect(service.getInstitution(institutionA.id, operationContext(admin))).resolves.toMatchObject({
      id: institutionA.id,
    });
  });

  it('2. rechaza crear o consultar una institución fuera del scope ordinario', async () => {
    await expect(
      service.createInstitution({ name: `No autorizada ${suffix}` }, operationContext(admin)),
    ).rejects.toMatchObject({ code: 'INSTITUTION_BOOTSTRAP_REQUIRED' });
    await expect(
      service.getInstitution(institutionB.id, operationContext(admin)),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('3. crea docentes, cuentas y vínculos institucionales de forma atómica', async () => {
    teacherA = await service.createTeacher(
      {
        institutionId: institutionA.id,
        displayName: 'Docente Uno',
        account: {
          kind: 'NEW',
          login: `academic-teacher-a-${suffix}`,
          password: 'Integracion-docente-A-2026!',
        },
      },
      operationContext(admin),
    );
    teacherB = await service.createTeacher(
      {
        institutionId: institutionA.id,
        displayName: 'Docente Dos',
        account: {
          kind: 'NEW',
          login: `academic-teacher-b-${suffix}`,
          password: 'Integracion-docente-B-2026!',
        },
      },
      operationContext(admin),
    );
    const stored = await client.teacher.findUniqueOrThrow({
      where: { id: teacherA.id },
      include: { user: true, institutions: true },
    });
    expect(stored.user.passwordHash).not.toContain('Integracion-docente-A-2026!');
    expect(stored.institutions).toHaveLength(1);
    expect(stored.institutions[0]?.institutionId).toBe(institutionA.id);
  });

  it('4. desactiva docente, revoca sesiones y permite reactivarlo sin restaurarlas', async () => {
    await client.authSession.create({
      data: {
        userId: teacherA.userId,
        tokenHash: hashSessionToken(createOpaqueSessionToken()),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await service.setTeacherActive(teacherA.id, institutionA.id, false, operationContext(admin));
    expect(
      await client.authSession.count({ where: { userId: teacherA.userId, revokedAt: null } }),
    ).toBe(0);
    teacherA = await service.setTeacherActive(
      teacherA.id,
      institutionA.id,
      true,
      operationContext(admin),
    );
    expect(teacherA.isActive).toBe(true);
  });

  it('5. crea y consulta el año lectivo activo institucional', async () => {
    yearA = await service.createAcademicYear(
      {
        institutionId: institutionA.id,
        label: `2026-${suffix}`,
        startsOn: new Date('2026-02-01'),
        endsOn: new Date('2026-11-30'),
        isCurrent: true,
      },
      operationContext(admin),
    );
    await expect(
      service.getCurrentAcademicYear(institutionA.id, operationContext(admin)),
    ).resolves.toMatchObject({ id: yearA.id, isCurrent: true });
  });

  it('6. rechaza dos años activos simultáneos en la misma institución', async () => {
    await expect(
      service.createAcademicYear(
        {
          institutionId: institutionA.id,
          label: `2027-${suffix}`,
          startsOn: new Date('2027-02-01'),
          endsOn: new Date('2027-11-30'),
          isCurrent: true,
        },
        operationContext(admin),
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('7. crea un curso normalizando grado, sección y turno', async () => {
    courseA = await service.createCourse(
      {
        institutionId: institutionA.id,
        academicYearId: yearA.id,
        grade: ' 1.º BTI ',
        section: ' A ',
        shift: ' Mañana ',
      },
      operationContext(admin),
    );
    expect(courseA).toMatchObject({ grade: '1.o bti', section: 'a', shift: 'manana' });
  });

  it('8. rechaza un curso con la misma combinación normalizada', async () => {
    await expect(
      service.createCourse(
        {
          institutionId: institutionA.id,
          academicYearId: yearA.id,
          grade: '1.º  BTI',
          section: 'a',
          shift: 'MAÑANA',
        },
        operationContext(admin),
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('9. crea materias como catálogo institucional genérico', async () => {
    subjectA = await service.createSubject(
      { institutionId: institutionA.id, name: 'Comunicación Técnica' },
      operationContext(admin),
    );
    subjectA2 = await service.createSubject(
      { institutionId: institutionA.id, name: 'Laboratorio General' },
      operationContext(admin),
    );
    expect(subjectA.curriculumDiscipline).toBeNull();
  });

  it('10. crea TeachingAssignment válidas', async () => {
    assignmentA = await service.createTeachingAssignment(
      {
        institutionId: institutionA.id,
        teacherId: teacherA.id,
        courseId: courseA.id,
        subjectId: subjectA.id,
      },
      operationContext(admin),
    );
    assignmentB = await service.createTeachingAssignment(
      {
        institutionId: institutionA.id,
        teacherId: teacherB.id,
        courseId: courseA.id,
        subjectId: subjectA2.id,
      },
      operationContext(admin),
    );
    expect(assignmentA.endedAt).toBeNull();
  });

  it('11. rechaza una TeachingAssignment duplicada', async () => {
    await expect(
      service.createTeachingAssignment(
        {
          institutionId: institutionA.id,
          teacherId: teacherA.id,
          courseId: courseA.id,
          subjectId: subjectA.id,
        },
        operationContext(admin),
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('12. rechaza docente, curso o materia de instituciones incompatibles', async () => {
    yearB = await client.academicYear.create({
      data: {
        institutionId: institutionB.id,
        label: `2026-${suffix}`,
        startsOn: new Date('2026-02-01'),
        endsOn: new Date('2026-11-30'),
      },
    });
    courseB = await client.course.create({
      data: {
        institutionId: institutionB.id,
        academicYearId: yearB.id,
        grade: '1',
        section: `x-${suffix}`,
        shift: 'm',
      },
    });
    subjectB = await client.subject.create({
      data: {
        institutionId: institutionB.id,
        name: `Materia B ${suffix}`,
        nameNormalized: `materia-b-${suffix}`,
      },
    });
    const crossUser = await client.user.create({
      data: {
        login: `cross-teacher-${suffix}`,
        loginNormalized: `cross-teacher-${suffix}`,
        passwordHash: 'integration-only',
      },
    });
    crossTeacher = await client.teacher.create({
      data: {
        userId: crossUser.id,
        displayName: 'Docente cruzado',
        institutions: { create: { institutionId: institutionB.id } },
      },
    });
    const attempts = [
      { teacherId: crossTeacher.id, courseId: courseA.id, subjectId: subjectA.id },
      { teacherId: teacherA.id, courseId: courseB.id, subjectId: subjectA.id },
      { teacherId: teacherA.id, courseId: courseA.id, subjectId: subjectB.id },
    ];
    for (const attempt of attempts) {
      await expect(
        service.createTeachingAssignment(
          { institutionId: institutionA.id, ...attempt },
          operationContext(admin),
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    }
  });

  it('13. rechaza entidades inactivas al crear asignaciones', async () => {
    await service.setSubjectActive(subjectA2.id, false, operationContext(admin));
    await expect(
      service.createTeachingAssignment(
        {
          institutionId: institutionA.id,
          teacherId: teacherA.id,
          courseId: courseA.id,
          subjectId: subjectA2.id,
        },
        operationContext(admin),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    subjectA2 = await service.setSubjectActive(subjectA2.id, true, operationContext(admin));

    await service.setCourseActive(courseA.id, false, operationContext(admin));
    await expect(
      service.createTeachingAssignment(
        {
          institutionId: institutionA.id,
          teacherId: teacherA.id,
          courseId: courseA.id,
          subjectId: subjectA2.id,
        },
        operationContext(admin),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    courseA = await service.setCourseActive(courseA.id, true, operationContext(admin));
  });

  it('14. Docente A consulta únicamente sus asignaciones mediante servicio y API', async () => {
    const mine = await service.listMyTeachingAssignments(operationContext(await client.user.findUniqueOrThrow({ where: { id: teacherA.userId } })));
    expect(mine.map(({ id }) => id)).toContain(assignmentA.id);
    expect(mine.map(({ id }) => id)).not.toContain(assignmentB.id);

    const token = createOpaqueSessionToken();
    await client.authSession.create({
      data: {
        userId: teacherA.userId,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const response = await request(app)
      .get('/api/v1/me/teaching-assignments')
      .set('Cookie', `${config.sessionCookieName}=${token}`);
    expect(response.status).toBe(200);
    expect(response.body.teachingAssignments.map(({ id }: { id: string }) => id)).toEqual([
      assignmentA.id,
    ]);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenHash/i);
  });

  it('15. Docente A no puede consultar la asignación de Docente B por UUID', async () => {
    const teacherAUser = await client.user.findUniqueOrThrow({ where: { id: teacherA.userId } });
    await expect(
      service.getTeachingAssignment(assignmentB.id, operationContext(teacherAUser)),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('16. retirar una asignación bloquea operaciones docentes y conserva historia', async () => {
    await service.setTeachingAssignmentActive(assignmentA.id, false, operationContext(admin));
    const teacherAUser = await client.user.findUniqueOrThrow({ where: { id: teacherA.userId } });
    await expect(
      service.getTeachingAssignment(assignmentA.id, operationContext(teacherAUser)),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(await service.listMyTeachingAssignments(operationContext(teacherAUser))).toHaveLength(0);
    const stored = await client.teachingAssignment.findUniqueOrThrow({ where: { id: assignmentA.id } });
    expect(stored.endedAt).not.toBeNull();
  });

  it('17. registra operaciones exitosas y rechazadas sin secretos', async () => {
    const audits = await client.auditLog.findMany({
      where: {
        OR: [
          { actorUserId: admin.id, action: { startsWith: 'teacher' } },
          { actorUserId: admin.id, action: { startsWith: 'academic-year' } },
          { actorUserId: admin.id, action: { startsWith: 'course' } },
          { actorUserId: admin.id, action: { startsWith: 'subject' } },
          { actorUserId: admin.id, action: { startsWith: 'teaching-assignment' } },
          { actorUserId: technical.id, action: 'institution.create' },
        ],
      },
    });
    expect(audits.some(({ outcome }) => outcome === 'SUCCESS')).toBe(true);
    expect(audits.some(({ outcome }) => outcome === 'DENIED')).toBe(true);
    expect(audits.some(({ action }) => action === 'teaching-assignment.retire')).toBe(true);
    expect(JSON.stringify(audits)).not.toMatch(/password|passwordHash|token|cookie/i);
  });

  it('protege la API académica con sesión y CSRF y atraviesa controller/service/repository', async () => {
    expect((await request(app).get(`/api/v1/courses?institutionId=${institutionA.id}`)).status).toBe(401);

    const token = createOpaqueSessionToken();
    await client.authSession.create({
      data: {
        userId: admin.id,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const sessionCookie = `${config.sessionCookieName}=${token}`;
    const withoutCsrf = await request(app)
      .post('/api/v1/subjects')
      .set('Cookie', sessionCookie)
      .send({ institutionId: institutionA.id, name: `API sin CSRF ${suffix}` });
    expect(withoutCsrf.status).toBe(403);

    const csrf = await request(app).get('/api/v1/auth/csrf').set('Cookie', sessionCookie);
    const setCookies = csrf.headers['set-cookie'] as unknown as string[];
    const csrfCookie = setCookies.find((value) => value.startsWith(`${config.csrfCookieName}=`));
    if (csrfCookie === undefined) throw new Error('No se emitió cookie CSRF');
    const csrfToken = csrf.body.csrfToken as string;
    const created = await request(app)
      .post('/api/v1/subjects')
      .set('Cookie', [sessionCookie, csrfCookie.split(';')[0] ?? ''])
      .set('x-csrf-token', csrfToken)
      .send({ institutionId: institutionA.id, name: `Materia API ${suffix}` });

    expect(created.status).toBe(201);
    expect(created.body.subject).toMatchObject({
      institutionId: institutionA.id,
      name: `Materia API ${suffix}`,
    });
    expect(JSON.stringify(created.body)).not.toMatch(/passwordHash|tokenHash/i);
  });
});
