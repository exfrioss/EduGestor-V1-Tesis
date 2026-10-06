import { randomUUID } from 'node:crypto';
import { AccountKind, PrismaClient, ScopeKind, type User } from '@prisma/client';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { AuthConfig } from './config.js';
import { createDatabaseProbe } from './database.js';
import { createOpaqueSessionToken, hashSessionToken } from './modules/auth/session-token.js';
import { normalizeNationalId } from './modules/students/national-id.js';
import { PERMISSION_CATALOG, type PermissionCode } from './modules/authorization/permission-catalog.js';

const describeDatabase = process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const db = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const config: AuthConfig = {
  sessionTtlMs: 28_800_000, lastSeenIntervalMs: 60_000,
  sessionCookieName: 'edugestor_session', csrfCookieName: 'edugestor_csrf', secureCookies: false,
  loginRateLimitWindowMs: 900_000, loginRateLimitMaxAttempts: 100,
};
const app = createApp(createDatabaseProbe(db), { logger: pino({ level: 'silent' }), auth: { client: db, config } });
let root: User, adminA: User, adminB: User, teacherUser: User;
let institutionA: string, institutionB: string, courseA: string, courseA2: string, courseB: string, yearA: string, yearB: string;
let roleId: string;
let aCookie: string, bCookie: string, teacherCookie: string, aCsrf: string, bCsrf: string;
const people = (label: string, kind = AccountKind.STANDARD) => db.user.create({ data: { login: `${label}-${suffix}`, loginNormalized: `${label}-${suffix}`, passwordHash: 'integration-only', accountKind: kind } });
const grant = async (actor: User, institutionId: string, permissions: PermissionCode[], kind = ScopeKind.INSTITUTION, courseId?: string) => {
  const scope = await db.accessScope.create({ data: { institutionId, kind, createdById: root.id, ...(courseId ? { courses: { create: { courseId } } } : {}) } });
  const assignment = await db.roleAssignment.create({ data: { userId: actor.id, roleId, scopeId: scope.id, grantedById: root.id } });
  for (const code of permissions) {
    const permission = await db.permission.findUniqueOrThrow({ where: { code } });
    await db.roleAssignmentPermission.create({ data: { roleAssignmentId: assignment.id, permissionId: permission.id, delegatedById: root.id } });
  }
};
const auth = async (user: User) => {
  const token = createOpaqueSessionToken();
  await db.authSession.create({ data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 3_600_000) } });
  const session = `${config.sessionCookieName}=${token}`;
  const result = await request(app).get('/api/v1/auth/csrf').set('Cookie', session);
  const csrfCookie = (result.headers['set-cookie'] as string[])[0]!.split(';')[0]!;
  return { cookie: `${session}; ${csrfCookie}`, csrf: result.body.csrfToken as string };
};
const base = (institutionId: string) => `/api/v1/institutions/${institutionId}`;
const newStudent = (courseId: string, academicYearId: string, nationalId?: string | null) => ({
  givenNames: 'Ana', familyNames: `Prueba ${suffix}`, nationalId: nationalId ?? null, academicYearId,
});
const postStudent = (institutionId: string, courseId: string, cookie: string, csrf: string, body: unknown) =>
  request(app).post(`${base(institutionId)}/courses/${courseId}/students`).set('Cookie', cookie).set('x-csrf-token', csrf).send(body);
const postEnrollment = (institutionId: string, courseId: string, cookie: string, csrf: string, studentId: string, academicYearId: string) =>
  request(app).post(`${base(institutionId)}/courses/${courseId}/enrollments`).set('Cookie', cookie).set('x-csrf-token', csrf).send({ studentId, academicYearId });

describeDatabase('STU-01 a STU-22 — Student y Enrollment con PostgreSQL real', () => {
  beforeAll(async () => {
    for (const permission of PERMISSION_CATALOG) await db.permission.upsert({ where: { code: permission.code }, create: permission, update: permission });
    [root, adminA, adminB, teacherUser] = await Promise.all([people('stu-root', AccountKind.TECHNICAL), people('stu-a'), people('stu-b'), people('stu-teacher')]);
    const [a, b] = await Promise.all([db.institution.create({ data: { name: `STU A ${suffix}` } }), db.institution.create({ data: { name: `STU B ${suffix}` } })]);
    institutionA = a.id; institutionB = b.id;
    const [ya, yb] = await Promise.all([
      db.academicYear.create({ data: { institutionId: a.id, label: `2026-${suffix}`, startsOn: new Date('2026-02-01'), endsOn: new Date('2026-11-30') } }),
      db.academicYear.create({ data: { institutionId: b.id, label: `2026-${suffix}`, startsOn: new Date('2026-02-01'), endsOn: new Date('2026-11-30') } }),
    ]);
    yearA = ya.id; yearB = yb.id;
    const [ca, ca2, cb] = await Promise.all([
      db.course.create({ data: { institutionId: a.id, academicYearId: ya.id, grade: '1', section: suffix, shift: 'Mañana' } }),
      db.course.create({ data: { institutionId: a.id, academicYearId: ya.id, grade: '2', section: suffix, shift: 'Mañana' } }),
      db.course.create({ data: { institutionId: b.id, academicYearId: yb.id, grade: '1', section: suffix, shift: 'Mañana' } }),
    ]);
    courseA = ca.id; courseA2 = ca2.id; courseB = cb.id;
    roleId = (await db.role.create({ data: { code: `STU-${suffix}`, name: 'Prueba STU' } })).id;
    const all: PermissionCode[] = ['student.read', 'student.manage', 'enrollment.read', 'enrollment.manage'];
    await grant(adminA, institutionA, all);
    await grant(adminB, institutionB, all);
    await grant(teacherUser, institutionA, ['student.read', 'enrollment.read'], ScopeKind.COURSE_SET, courseA);
    const teacher = await db.teacher.create({ data: { userId: teacherUser.id, displayName: 'Docente STU' } });
    await db.teacherInstitution.create({ data: { teacherId: teacher.id, institutionId: institutionA } });
    const subject = await db.subject.create({ data: { institutionId: institutionA, name: `STU ${suffix}`, nameNormalized: `stu-${suffix}` } });
    await db.teachingAssignment.create({ data: { teacherId: teacher.id, institutionId: institutionA, courseId: courseA, subjectId: subject.id } });
    const [aAuth, bAuth, tAuth] = await Promise.all([auth(adminA), auth(adminB), auth(teacherUser)]);
    aCookie = aAuth.cookie; bCookie = bAuth.cookie; teacherCookie = tAuth.cookie; aCsrf = aAuth.csrf; bCsrf = bAuth.csrf;
  });
  afterAll(async () => db.$disconnect());

  it('STU-01: alta atómica, UUID, año y auditoría', async () => {
    const res = await postStudent(institutionA, courseA, aCookie, aCsrf, newStudent(courseA, yearA, `001.${Date.now()}`));
    expect(res.status).toBe(201);
    expect(res.body.data.student.id).not.toBe(res.body.data.enrollment.id);
    expect(res.body.data.enrollment.academicYearId).toBe(yearA);
    expect(await db.auditLog.count({ where: { entityId: res.body.data.student.id, outcome: 'SUCCESS' } })).toBe(1);
  });

  it('STU-02 y STU-03: ausencia real y normalización con ceros iniciales', async () => {
    expect(normalizeNationalId('001.234-5').nationalIdNormalized).toBe('0012345');
    expect(normalizeNationalId('0012345').nationalIdNormalized).toBe('0012345');
    expect(normalizeNationalId(null).nationalIdNormalized).toBeNull();
    const first = await postStudent(institutionA, courseA, aCookie, aCsrf, newStudent(courseA, yearA));
    const second = await postStudent(institutionA, courseA, aCookie, aCsrf, newStudent(courseA, yearA));
    expect([first.status, second.status]).toEqual([201, 201]);
    const students = await db.student.findMany({ where: { id: { in: [first.body.data.student.id, second.body.data.student.id] } } });
    expect(students.every(s => s.nationalId === null && s.nationalIdNormalized === null)).toBe(true);
  });

  it('STU-04 y STU-05: unicidad de cédula serial y concurrente sin auditoría huérfana', async () => {
    const number = `00${Date.now()}4`;
    const first = await postStudent(institutionA, courseA, aCookie, aCsrf, newStudent(courseA, yearA, number));
    const duplicate = await postStudent(institutionA, courseA, aCookie, aCsrf, newStudent(courseA, yearA, number));
    expect(first.status).toBe(201); expect(duplicate.status).toBe(409);
    expect(duplicate.body.data).toBeUndefined();
    const concurrentId = `00${Date.now()}5`;
    const [left, right] = await Promise.all([
      postStudent(institutionA, courseA, aCookie, aCsrf, newStudent(courseA, yearA, concurrentId)),
      postStudent(institutionA, courseA, aCookie, aCsrf, newStudent(courseA, yearA, concurrentId)),
    ]);
    expect([left.status, right.status].sort()).toEqual([201, 409]);
    expect(await db.student.count({ where: { nationalIdNormalized: concurrentId } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: 'student.create', entityId: [left,right].find(r => r.status === 201)!.body.data.student.id } })).toBe(1);
  });

  it('STU-06 y STU-07: versión, corrección y activación conservan identidad e historia', async () => {
    const created = await postStudent(institutionA, courseA, aCookie, aCsrf, newStudent(courseA, yearA));
    const id = created.body.data.student.id as string;
    const path = `${base(institutionA)}/students/${id}`;
    const changed = await request(app).patch(path).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ familyNames: 'Corregido', nationalId: `000.${Date.now()}`, expectedVersion: 1 });
    expect(changed.status).toBe(200); expect(changed.body.data.id).toBe(id); expect(changed.body.data.rowVersion).toBe(2);
    expect((await request(app).patch(path).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ givenNames: 'Tarde', expectedVersion: 1 })).body.error.code).toBe('STALE_VERSION');
    const off = await request(app).patch(`${path}/activation`).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ isActive: false, expectedVersion: 2 });
    expect(off.status).toBe(200); expect(off.body.data.isActive).toBe(false);
    expect((await request(app).get(path).set('Cookie', aCookie)).status).toBe(200);
    expect((await postEnrollment(institutionA, courseA2, aCookie, aCsrf, id, yearA)).status).toBe(409);
    const on = await request(app).patch(`${path}/activation`).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ isActive: true, expectedVersion: 3 });
    expect(on.status).toBe(200); expect(on.body.data.id).toBe(id);
    const removed = await request(app).patch(path).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ nationalId: null, expectedVersion: 4 });
    expect(removed.status).toBe(200); expect(removed.body.data.nationalId).toBeNull();
    const corrected = await request(app).patch(path).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ nationalId: `00${Date.now()}6`, expectedVersion: 5 });
    expect(corrected.status).toBe(200); expect(corrected.body.data.id).toBe(id);
    const [parallelA, parallelB] = await Promise.all([
      request(app).patch(path).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ givenNames: 'Uno', expectedVersion: 6 }),
      request(app).patch(path).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ givenNames: 'Dos', expectedVersion: 6 }),
    ]);
    expect([parallelA.status, parallelB.status].sort()).toEqual([200, 409]);
    expect([parallelA, parallelB].find(r => r.status === 409)!.body.error.code).toBe('STALE_VERSION');
    expect(await db.enrollment.count({ where: { studentId: id } })).toBe(1);
  });

  it('STU-08 a STU-11: reutilización, unicidad concurrente y año compatible', async () => {
    const created = await postStudent(institutionA, courseA, aCookie, aCsrf, newStudent(courseA, yearA));
    const id = created.body.data.student.id as string;
    const badYear = await postEnrollment(institutionA, courseA2, aCookie, aCsrf, id, yearB);
    expect(badYear.status).toBe(422);
    const [first, second] = await Promise.all([postEnrollment(institutionA, courseA2, aCookie, aCsrf, id, yearA), postEnrollment(institutionA, courseA2, aCookie, aCsrf, id, yearA)]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect((await postEnrollment(institutionA, courseA2, aCookie, aCsrf, id, yearA)).status).toBe(409);
    expect(await db.enrollment.count({ where: { studentId: id, courseId: courseA2 } })).toBe(1);
    await expect(db.enrollment.create({ data: { studentId: id, courseId: courseA2, academicYearId: yearB } })).rejects.toThrow();
    await expect(db.course.create({ data: { institutionId: institutionA, academicYearId: yearB, grade: 'Cruce', section: suffix, shift: 'Mañana' } })).rejects.toThrow();
  });

  it('STU-12: institución, curso y Student inactivos bloquean nuevas matrículas', async () => {
    const created = await postStudent(institutionA, courseA, aCookie, aCsrf, newStudent(courseA, yearA));
    const id = created.body.data.student.id as string;
    await db.course.update({ where: { id: courseA2 }, data: { isActive: false, disabledAt: new Date(), disabledById: adminA.id } });
    expect((await postEnrollment(institutionA, courseA2, aCookie, aCsrf, id, yearA)).status).toBe(409);
    await db.course.update({ where: { id: courseA2 }, data: { isActive: true, disabledAt: null, disabledById: null } });
    await db.institution.update({ where: { id: institutionA }, data: { isActive: false, disabledAt: new Date(), disabledById: adminA.id } });
    expect((await postEnrollment(institutionA, courseA2, aCookie, aCsrf, id, yearA)).status).toBe(409);
    await db.institution.update({ where: { id: institutionA }, data: { isActive: true, disabledAt: null, disabledById: null } });
    expect(await db.enrollment.count({ where: { studentId: id } })).toBe(1);
  });

  it('STU-13 a STU-16: aislamiento y lectura docente contextual', async () => {
    const inB = await postStudent(institutionB, courseB, bCookie, bCsrf, newStudent(courseB, yearB));
    const studentB = inB.body.data.student.id as string;
    const enrollmentB = inB.body.data.enrollment.id as string;
    expect((await request(app).get(`${base(institutionA)}/students/${studentB}`).set('Cookie', aCookie)).status).toBe(404);
    expect((await request(app).get(`${base(institutionA)}/enrollments/${enrollmentB}`).set('Cookie', aCookie)).status).toBe(404);
    expect((await request(app).get(`${base(institutionA)}/courses/${courseB}/students`).set('Cookie', aCookie)).status).toBe(404);
    expect((await request(app).patch(`${base(institutionA)}/students/${studentB}`).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ givenNames: 'No', expectedVersion: 1 })).status).toBe(404);
    expect((await postEnrollment(institutionA, courseA, aCookie, aCsrf, studentB, yearA)).status).toBe(404);
    const inA = await postStudent(institutionA, courseA, aCookie, aCsrf, newStudent(courseA, yearA));
    const studentA = inA.body.data.student.id as string;
    const teacherRoster = await request(app).get(`${base(institutionA)}/courses/${courseA}/students`).set('Cookie', teacherCookie);
    expect(teacherRoster.status).toBe(200);
    expect(teacherRoster.body.data.some((r: { studentId: string }) => r.studentId === studentA)).toBe(true);
    const ungrantedUser = await people('stu-ungranted');
    const ungrantedTeacher = await db.teacher.create({ data: { userId: ungrantedUser.id, displayName: 'Sin permiso' } });
    await db.teacherInstitution.create({ data: { teacherId: ungrantedTeacher.id, institutionId: institutionA } });
    const subject = await db.subject.findFirstOrThrow({ where: { institutionId: institutionA } });
    await db.teachingAssignment.create({ data: { teacherId: ungrantedTeacher.id, institutionId: institutionA, courseId: courseA, subjectId: subject.id } });
    const ungrantedAuth = await auth(ungrantedUser);
    expect((await request(app).get(`${base(institutionA)}/courses/${courseA}/students`).set('Cookie', ungrantedAuth.cookie)).status).toBe(403);
    expect((await request(app).get(`${base(institutionA)}/courses/${courseA2}/students`).set('Cookie', teacherCookie)).status).toBe(403);
    expect((await request(app).get(`${base(institutionA)}/students`).set('Cookie', teacherCookie)).status).toBe(400);
    const assignment = await db.teachingAssignment.findFirstOrThrow({ where: { courseId: courseA, teacher: { userId: teacherUser.id } } });
    await db.teachingAssignment.update({ where: { id: assignment.id }, data: { endedAt: new Date() } });
    expect((await request(app).get(`${base(institutionA)}/courses/${courseA}/students`).set('Cookie', teacherCookie)).status).toBe(403);
    await db.teachingAssignment.update({ where: { id: assignment.id }, data: { endedAt: null } });
    await db.enrollment.create({ data: { studentId: studentA, courseId: courseB, academicYearId: yearB } });
    const history = await request(app).get(`${base(institutionA)}/students/${studentA}/enrollments`).set('Cookie', aCookie);
    expect(history.status).toBe(200);
    expect(history.body.data.every((r: { courseId: string }) => r.courseId !== courseB)).toBe(true);
    expect((await request(app).get(`${base(institutionA)}/students/${studentA}`).set('Cookie', aCookie)).body.data.enrollments.every((r: { courseId: string }) => r.courseId !== courseB)).toBe(true);
  });

  it('STU-17 y STU-18: cambio global denegado y cédula externa opaca', async () => {
    const shared = await postStudent(institutionA, courseA, aCookie, aCsrf, newStudent(courseA, yearA));
    const studentId = shared.body.data.student.id as string;
    await db.enrollment.create({ data: { studentId, courseId: courseB, academicYearId: yearB } });
    const blocked = await request(app).patch(`${base(institutionA)}/students/${studentId}`).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ givenNames: 'No', expectedVersion: 1 });
    expect(blocked.status).toBe(403); expect(blocked.body.error.code).toBe('PERMISSION_DENIED');
    expect(JSON.stringify(blocked.body)).not.toContain(institutionB);
    const hiddenId = `00${Date.now()}8`;
    await postStudent(institutionB, courseB, bCookie, bCsrf, newStudent(courseB, yearB, hiddenId));
    const lookup = await request(app).get(`${base(institutionA)}/students?q=${hiddenId}`).set('Cookie', aCookie);
    expect(lookup.status).toBe(200); expect(lookup.body.data).toHaveLength(0);
    const rejected = await postStudent(institutionA, courseA, aCookie, aCsrf, newStudent(courseA, yearA, hiddenId));
    expect(rejected.status).toBe(409); expect(JSON.stringify(rejected.body)).not.toContain(institutionB);
    expect(rejected.body.data).toBeUndefined();
  });

  it('STU-17: matrícula concurrente y PATCH global se serializan por Student', async () => {
    const actor = await people('stu-cross');
    await grant(actor, institutionA, ['student.read', 'enrollment.read']);
    await grant(actor, institutionB, ['enrollment.manage']);
    const actorAuth = await auth(actor);
    const created = await postStudent(institutionA, courseA, aCookie, aCsrf, newStudent(courseA, yearA));
    const studentId = created.body.data.student.id as string;
    const [patch, enrollment] = await Promise.all([
      request(app).patch(`${base(institutionA)}/students/${studentId}`).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ givenNames: 'Concurrente', expectedVersion: 1 }),
      postEnrollment(institutionB, courseB, actorAuth.cookie, actorAuth.csrf, studentId, yearB),
    ]);
    expect(enrollment.status).toBe(201);
    expect([200, 403]).toContain(patch.status);
    if (patch.status === 200) {
      const update = await db.auditLog.findFirstOrThrow({ where: { entityId: studentId, action: 'student.update' } });
      const inserted = await db.enrollment.findFirstOrThrow({ where: { studentId, courseId: courseB } });
      expect(update.occurredAt.getTime()).toBeLessThanOrEqual(inserted.createdAt.getTime());
    } else {
      expect(patch.body.error.code).toBe('PERMISSION_DENIED');
    }
  });

  it('STU-19 y STU-20: nómina paginada e historial autorizado', async () => {
    const first = await request(app).get(`${base(institutionA)}/courses/${courseA}/students?limit=1`).set('Cookie', aCookie);
    expect(first.status).toBe(200); expect(first.body.data).toHaveLength(1);
    expect(first.body.nextCursor).toBeTruthy();
    const next = await request(app).get(`${base(institutionA)}/courses/${courseA}/students?limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`).set('Cookie', aCookie);
    expect(next.status).toBe(200); expect(next.body.data[0].id).not.toBe(first.body.data[0].id);
    const readGrant = await db.roleAssignmentPermission.findFirstOrThrow({ where: { assignment: { userId: adminA.id }, permission: { code: 'student.read' } } });
    await db.roleAssignmentPermission.update({ where: { id: readGrant.id }, data: { revokedAt: new Date() } });
    expect((await request(app).get(`${base(institutionA)}/courses/${courseA}/students?limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`).set('Cookie', aCookie)).status).toBe(403);
    await db.roleAssignmentPermission.update({ where: { id: readGrant.id }, data: { revokedAt: null } });
    const id = first.body.data[0].studentId as string;
    const history = await request(app).get(`${base(institutionA)}/students/${id}/enrollments?courseId=${courseA}`).set('Cookie', teacherCookie);
    expect(history.status).toBe(200); expect(history.body.data.every((r: { courseId: string }) => r.courseId === courseA)).toBe(true);
  });

  it('STU-21 y STU-22: sesión, CSRF, payload estricto e historia inmutable', async () => {
    expect((await request(app).get(`${base(institutionA)}/students`)).status).toBe(401);
    expect((await request(app).post(`${base(institutionA)}/courses/${courseA}/students`).set('Cookie', aCookie).send(newStudent(courseA, yearA))).body.error.code).toBe('CSRF_TOKEN_INVALID');
    const invalid = await postStudent(institutionA, courseA, aCookie, aCsrf, { ...newStudent(courseA, yearA), invented: true });
    expect(invalid.status).toBe(400); expect(invalid.body.error.requestId).toBeTruthy();
    const enrollment = await db.enrollment.findFirstOrThrow({ where: { courseId: courseA } });
    await expect(db.enrollment.update({ where: { id: enrollment.id }, data: { courseId: courseA2 } })).rejects.toThrow();
    await expect(db.enrollment.delete({ where: { id: enrollment.id } })).rejects.toThrow();
  });

  it('STU-26: conserva 17 permisos previos y el demo no recibe los cuatro nuevos', async () => {
    expect(PERMISSION_CATALOG).toHaveLength(21);
    const demoGrants = await db.roleAssignmentPermission.count({ where: {
      assignment: { role: { code: 'HITO1_DEMO_INSTITUTION_ADMIN' } },
      permission: { code: { in: ['student.read', 'student.manage', 'enrollment.read', 'enrollment.manage'] } },
    } });
    expect(demoGrants).toBe(0);
  });
});
