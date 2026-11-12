import { randomUUID } from 'node:crypto';
import { AccountKind, PrismaClient, ScopeKind, type User } from '@prisma/client';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { AuthConfig } from './config.js';
import { createDatabaseProbe } from './database.js';
import { createOpaqueSessionToken, hashSessionToken } from './modules/auth/session-token.js';
import { PERMISSION_CATALOG, type PermissionCode } from './modules/authorization/permission-catalog.js';

const describeDatabase = process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const db = new PrismaClient();
const config: AuthConfig = { sessionTtlMs: 28_800_000, lastSeenIntervalMs: 60_000, sessionCookieName: 'edugestor_session', csrfCookieName: 'edugestor_csrf', secureCookies: false, loginRateLimitWindowMs: 900_000, loginRateLimitMaxAttempts: 100, confirmationActiveKid: 'integration', confirmationKeys: { integration: 'integration-confirmation-secret-3a-0000000001' } };
const app = createApp(createDatabaseProbe(db), { logger: pino({ level: 'silent' }), auth: { client: db, config } });
const suffix = randomUUID().slice(0, 8);
let root: User, teacherA: User, teacherB: User, admin: User;
let institutionId: string, foreignInstitutionId: string, courseId: string, foreignCourseId: string, otherCourseId: string, yearId: string, assignmentId: string, foreignAssignmentId: string, outOfScopeAssignmentId: string, subjectId: string;
let sessionId: string, secondSessionId: string, foreignEnrollmentId: string;
let enrollments: string[] = [], students: string[] = [];
let aCookie: string, aCsrf: string, bCookie: string, bCsrf: string, adminCookie: string;
const base = () => `/api/v1/teaching-assignments/${assignmentId}/attendance-sessions`;
const recordPath = (session: string, enrollment: string) => `${base()}/${session}/records/${enrollment}`;
const person = (name: string, kind = AccountKind.STANDARD) => db.user.create({ data: { login: `${name}-${suffix}`, loginNormalized: `${name}-${suffix}`, passwordHash: 'integration-only', accountKind: kind } });
const grant = async (user: User, roleId: string, institutionId: string, codes: PermissionCode[], course?: string) => {
  const scope = await db.accessScope.create({ data: { institutionId, kind: course ? ScopeKind.COURSE_SET : ScopeKind.INSTITUTION, createdById: root.id, ...(course ? { courses: { create: { courseId: course } } } : {}) } });
  const assignment = await db.roleAssignment.create({ data: { userId: user.id, roleId, scopeId: scope.id, grantedById: root.id } });
  for (const code of codes) {
    const permission = await db.permission.findUniqueOrThrow({ where: { code } });
    await db.roleAssignmentPermission.create({ data: { roleAssignmentId: assignment.id, permissionId: permission.id, delegatedById: root.id } });
  }
};
const auth = async (user: User) => {
  const token = createOpaqueSessionToken();
  await db.authSession.create({ data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 3_600_000) } });
  const session = `${config.sessionCookieName}=${token}`;
  const result = await request(app).get('/api/v1/auth/csrf').set('Cookie', session);
  return { cookie: `${session}; ${(result.headers['set-cookie'] as string[])[0]!.split(';')[0]!}`, csrf: result.body.csrfToken as string };
};
const get = (path: string, cookie = aCookie) => request(app).get(path).set('Cookie', cookie);
const post = (path: string, body: unknown, cookie = aCookie, csrf = aCsrf) => request(app).post(path).set('Cookie', cookie).set('x-csrf-token', csrf).send(body);
const put = (path: string, body: unknown, cookie = aCookie, csrf = aCsrf) => request(app).put(path).set('Cookie', cookie).set('x-csrf-token', csrf).send(body);
const mark = (status: string, expectedVersion: number | null = null, extra: object = {}) => ({ status, isJustified: false, expectedVersion, ...extra });

describeDatabase('A-01–A-23: asistencia sobre PostgreSQL real', () => {
  beforeAll(async () => {
    for (const item of PERMISSION_CATALOG) await db.permission.upsert({ where: { code: item.code }, create: item, update: { description: item.description } });
    [root, teacherA, teacherB, admin] = await Promise.all([person('a-root', AccountKind.TECHNICAL), person('a-teacher'), person('a-teacher-b'), person('a-admin')]);
    const [institution, foreign] = await Promise.all([db.institution.create({ data: { name: `A ${suffix}` } }), db.institution.create({ data: { name: `A foreign ${suffix}` } })]);
    institutionId = institution.id; foreignInstitutionId = foreign.id;
    const [year, foreignYear] = await Promise.all([db.academicYear.create({ data: { institutionId, label: `2026-${suffix}`, startsOn: new Date('2026-02-01'), endsOn: new Date('2026-11-30') } }), db.academicYear.create({ data: { institutionId: foreignInstitutionId, label: `2026-${suffix}`, startsOn: new Date('2026-02-01'), endsOn: new Date('2026-11-30') } })]);
    yearId = year.id;
    const [course, foreignCourse, otherCourse] = await Promise.all([db.course.create({ data: { institutionId, academicYearId: year.id, grade: '1', section: suffix, shift: 'Mañana' } }), db.course.create({ data: { institutionId: foreignInstitutionId, academicYearId: foreignYear.id, grade: '1', section: suffix, shift: 'Mañana' } }), db.course.create({ data: { institutionId, academicYearId: year.id, grade: '2', section: suffix, shift: 'Mañana' } })]);
    courseId = course.id; foreignCourseId = foreignCourse.id; otherCourseId = otherCourse.id;
    const [subject, foreignSubject] = await Promise.all([db.subject.create({ data: { institutionId, name: `Asistencia ${suffix}`, nameNormalized: `attendance-${suffix}` } }), db.subject.create({ data: { institutionId: foreignInstitutionId, name: `Asistencia ${suffix}`, nameNormalized: `attendance-${suffix}` } })]);
    subjectId = subject.id;
    const [a, b] = await Promise.all([db.teacher.create({ data: { userId: teacherA.id, displayName: 'Docente A' } }), db.teacher.create({ data: { userId: teacherB.id, displayName: 'Docente B' } })]);
    await Promise.all([db.teacherInstitution.create({ data: { teacherId: a.id, institutionId } }), db.teacherInstitution.create({ data: { teacherId: b.id, institutionId } }), db.teacherInstitution.create({ data: { teacherId: a.id, institutionId: foreignInstitutionId } })]);
    assignmentId = (await db.teachingAssignment.create({ data: { teacherId: a.id, institutionId, courseId, subjectId } })).id;
    foreignAssignmentId = (await db.teachingAssignment.create({ data: { teacherId: b.id, institutionId, courseId, subjectId } })).id;
    outOfScopeAssignmentId = (await db.teachingAssignment.create({ data: { teacherId: a.id, institutionId, courseId: otherCourseId, subjectId } })).id;
    const foreignStudent = await db.student.create({ data: { givenNames: 'Fuera', familyNames: 'Contexto' } });
    foreignEnrollmentId = (await db.enrollment.create({ data: { studentId: foreignStudent.id, courseId: foreignCourseId, academicYearId: foreignYear.id } })).id;
    for (let i = 0; i < 40; i++) {
      const student = await db.student.create({ data: { givenNames: `Alumno ${i}`, familyNames: 'Prueba' } });
      students.push(student.id);
      enrollments.push((await db.enrollment.create({ data: { studentId: student.id, courseId, academicYearId: year.id } })).id);
    }
    const role = (await db.role.create({ data: { code: `ATT-${suffix}`, name: 'Attendance test' } })).id;
    const all: PermissionCode[] = ['attendance.read', 'attendance.manage', 'enrollment.read', 'student.read'];
    await grant(teacherA, role, institutionId, all, courseId);
    await grant(teacherB, role, institutionId, all, courseId);
    await grant(admin, role, institutionId, ['attendance.read', 'enrollment.read', 'student.read'], courseId);
    const [aa, bb, cc] = await Promise.all([auth(teacherA), auth(teacherB), auth(admin)]);
    aCookie = aa.cookie; aCsrf = aa.csrf; bCookie = bb.cookie; bCsrf = bb.csrf; adminCookie = cc.cookie;
  });
  afterAll(async () => db.$disconnect());

  it('A-01/A-02/A-09: crea dos sesiones independientes sin marcas ni fecha mutable', async () => {
    const first = await post(base(), { classDate: '2026-05-20' });
    expect(first.status).toBe(201); sessionId = first.body.data.id;
    const second = await post(base(), { classDate: '2026-05-20' });
    expect(second.status).toBe(201); secondSessionId = second.body.data.id;
    expect(secondSessionId).not.toBe(sessionId);
    expect(await db.attendanceRecord.count({ where: { attendanceSessionId: sessionId } })).toBe(0);
    expect((await get(`${base()}/${sessionId}`)).body.data.records).toEqual([]);
    expect(await db.auditLog.count({ where: { entityType: 'AttendanceSession', entityId: sessionId, action: 'attendance-session.create' } })).toBe(1);
    await expect(db.attendanceSession.update({ where: { id: sessionId }, data: { classDate: new Date('2026-05-21') } })).rejects.toThrow();
    await expect(db.attendanceSession.update({ where: { id: sessionId }, data: { teachingAssignmentId: foreignAssignmentId } })).rejects.toThrow();
    await expect(db.attendanceSession.delete({ where: { id: sessionId } })).rejects.toThrow();
    expect((await request(app).patch(`${base()}/${sessionId}`).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ classDate: '2026-05-21' })).status).toBe(404);
  });

  it('A-03–A-06: guarda los cuatro estados exactos y no infiere filas', async () => {
    const values = ['PRESENTE', 'AUSENTE', 'LLEGADA_TARDIA', 'SALIDA_ANTICIPADA'];
    for (let i = 0; i < 4; i++) expect((await put(recordPath(sessionId, enrollments[i]!), mark(values[i]!))).status).toBe(201);
    const detail = await get(`${base()}/${sessionId}`);
    expect(detail.body.data.records).toHaveLength(4);
    expect(detail.body.data.records.map((row: { status: string }) => row.status).sort()).toEqual([...values].sort());
    expect((await put(recordPath(sessionId, enrollments[5]!), mark('JUSTIFICADO'))).status).toBe(400);
    expect((await get(`${base()}/${secondSessionId}`)).body.data.records).toEqual([]);
  });

  it('A-07/A-08: justificación independiente, validación y limpieza true→false', async () => {
    const path = recordPath(sessionId, enrollments[1]!);
    expect((await put(path, mark('AUSENTE', 1, { isJustified: false, justificationObservation: 'inválida' }))).status).toBe(400);
    const justified = await put(path, mark('AUSENTE', 1, { isJustified: true, justificationObservation: 'Certificado', observation: 'Observación general' }));
    expect(justified.status).toBe(200);
    expect(justified.body.data).toMatchObject({ status: 'AUSENTE', isJustified: true, justificationObservation: 'Certificado', observation: 'Observación general' });
    const cleared = await put(path, mark('AUSENTE', 2));
    expect(cleared.body.data).toMatchObject({ isJustified: false, justificationObservation: null, observation: 'Observación general' });
    const edited = await put(path, mark('AUSENTE', 3, { observation: null }));
    expect(edited.body.data.observation).toBeNull();
    await expect(db.$executeRaw`UPDATE "AttendanceRecord" SET "isJustified" = false, "justificationObservation" = 'inválida' WHERE "id" = ${edited.body.data.id}::uuid`).rejects.toThrow();
    const late = await put(recordPath(sessionId, enrollments[2]!), mark('LLEGADA_TARDIA', 1, { isJustified: true }));
    expect(late.body.data).toMatchObject({ status: 'LLEGADA_TARDIA', isJustified: true, justificationObservation: null });
  });

  it('A-10/A-15: carreras reales dejan una fila o una corrección ganadora', async () => {
    const path = recordPath(sessionId, enrollments[6]!);
    const [a, b] = await Promise.all([put(path, mark('PRESENTE')), put(path, mark('AUSENTE'))]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await db.attendanceRecord.count({ where: { attendanceSessionId: sessionId, enrollmentId: enrollments[6] } })).toBe(1);
    const winner = [a, b].find(row => row.status === 201)!;
    expect(await db.auditLog.count({ where: { entityType: 'AttendanceRecord', entityId: winner.body.data.id, action: 'attendance-record.create' } })).toBe(1);
    const [c, d] = await Promise.all([put(path, mark('PRESENTE', 1)), put(path, mark('AUSENTE', 1))]);
    expect([c.status, d.status].sort()).toEqual([200, 409]);
    expect([c, d].find(row => row.status === 409)!.body.error.code).toBe('STALE_VERSION');
    expect((await db.attendanceRecord.findUniqueOrThrow({ where: { id: winner.body.data.id } })).rowVersion).toBe(2);
  });

  it('A-11/A-12/A-13: matrícula y asignación ajenas no amplían ámbito', async () => {
    expect((await put(recordPath(sessionId, foreignEnrollmentId), mark('PRESENTE'))).status).toBe(422);
    expect((await put(recordPath(sessionId, randomUUID()), mark('PRESENTE'))).status).toBe(404);
    expect((await get(`${base()}/${sessionId}`, bCookie)).status).toBe(404);
    expect((await put(recordPath(sessionId, enrollments[7]!), mark('PRESENTE'), bCookie, bCsrf)).status).toBe(404);
    expect((await get(`/api/v1/institutions/${foreignInstitutionId}/courses/${courseId}/attendance-sessions`, adminCookie)).status).toBe(404);
    expect((await get(`/api/v1/institutions/${foreignInstitutionId}/enrollments/${enrollments[0]}/attendance?assignmentId=${assignmentId}`, adminCookie)).status).toBe(404);
    expect((await get(`/api/v1/institutions/${institutionId}/courses/${otherCourseId}/attendance-sessions`)).status).toBe(403);
    expect((await post(`/api/v1/teaching-assignments/${outOfScopeAssignmentId}/attendance-sessions`, { classDate: '2026-05-22' })).status).toBe(403);
    const direct = await db.attendanceSession.create({ data: { teachingAssignmentId: assignmentId, classDate: new Date('2026-05-22'), createdById: teacherA.id } });
    await expect(db.attendanceRecord.create({ data: { attendanceSessionId: direct.id, enrollmentId: foreignEnrollmentId, status: 'PRESENTE', recordedById: teacherA.id } })).rejects.toThrow();
  });

  it('A-14: corrección preserva identidad y creador, audita before/after y bloquea DELETE', async () => {
    const before = await db.attendanceRecord.findUniqueOrThrow({ where: { attendanceSessionId_enrollmentId: { attendanceSessionId: sessionId, enrollmentId: enrollments[0]! } } });
    const changed = await put(recordPath(sessionId, enrollments[0]!), mark('AUSENTE', before.rowVersion));
    expect(changed.status).toBe(200);
    expect(changed.body.data).toMatchObject({ id: before.id, attendanceSessionId: sessionId, enrollmentId: enrollments[0], recordedById: teacherA.id, rowVersion: before.rowVersion + 1 });
    expect(new Date(changed.body.data.updatedAt).getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'attendance-record.update', entityId: before.id }, orderBy: { occurredAt: 'desc' } });
    expect(audit.actorUserId).toBe(teacherA.id);
    expect(audit.beforeData).toMatchObject({ status: 'PRESENTE' });
    expect(audit.afterData).toMatchObject({ status: 'AUSENTE' });
    await expect(db.attendanceRecord.update({ where: { id: before.id }, data: { recordedById: teacherB.id } })).rejects.toThrow();
    await expect(db.attendanceRecord.update({ where: { id: before.id }, data: { enrollmentId: enrollments[2]! } })).rejects.toThrow();
    await expect(db.attendanceRecord.update({ where: { id: before.id }, data: { attendanceSessionId: secondSessionId } })).rejects.toThrow();
    await expect(db.attendanceRecord.delete({ where: { id: before.id } })).rejects.toThrow();
    await expect(db.teachingAssignment.update({ where: { id: assignmentId }, data: { courseId: foreignCourseId } })).rejects.toThrow();
  });

  it('A-16: lote de 30 es atómico y rechaza duplicados o versión obsoleta', async () => {
    const records = enrollments.slice(10, 40).map(enrollmentId => ({ enrollmentId, ...mark('PRESENTE') }));
    const result = await put(`${base()}/${sessionId}/records/batch`, { records });
    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({ createdCount: 30, updatedCount: 0 });
    expect(await db.attendanceRecord.count({ where: { attendanceSessionId: sessionId, enrollmentId: { in: enrollments.slice(10, 40) } } })).toBe(30);
    expect((await put(`${base()}/${sessionId}/records/batch`, { records: [records[0], records[0]] })).status).toBe(400);
    const beforeAudits = await db.auditLog.count({ where: { action: 'attendance-record.update', entityType: 'AttendanceRecord' } });
    const broken = await put(`${base()}/${sessionId}/records/batch`, { records: [
      { enrollmentId: enrollments[10], ...mark('AUSENTE', 1) },
      { enrollmentId: enrollments[11], ...mark('AUSENTE', 999) },
    ] });
    expect(broken.status).toBe(409);
    expect((await db.attendanceRecord.findUniqueOrThrow({ where: { attendanceSessionId_enrollmentId: { attendanceSessionId: sessionId, enrollmentId: enrollments[10]! } } })).status).toBe('PRESENTE');
    expect(await db.auditLog.count({ where: { action: 'attendance-record.update', entityType: 'AttendanceRecord' } })).toBe(beforeAudits);
    const incompatible = await put(`${base()}/${sessionId}/records/batch`, { records: [
      { enrollmentId: enrollments[8], ...mark('PRESENTE') },
      { enrollmentId: foreignEnrollmentId, ...mark('PRESENTE') },
    ] });
    expect(incompatible.status).toBe(422);
    expect(await db.attendanceRecord.count({ where: { attendanceSessionId: sessionId, enrollmentId: enrollments[8] } })).toBe(0);
  });

  it('A-17/A-18: Student inactivo conserva historia; matrícula posterior no crea fila retroactiva', async () => {
    await db.student.update({ where: { id: students[3] }, data: { isActive: false, disabledAt: new Date(), disabledById: admin.id } });
    const previous = await db.attendanceRecord.findUniqueOrThrow({ where: { attendanceSessionId_enrollmentId: { attendanceSessionId: sessionId, enrollmentId: enrollments[3]! } } });
    expect((await put(recordPath(sessionId, enrollments[3]!), mark('PRESENTE', previous.rowVersion))).status).toBe(200);
    await db.student.update({ where: { id: students[7] }, data: { isActive: false, disabledAt: new Date(), disabledById: admin.id } });
    expect((await put(recordPath(sessionId, enrollments[7]!), mark('PRESENTE'))).status).toBe(409);
    expect((await get(`${base()}/${sessionId}`)).body.data.records.some((row: { enrollmentId: string }) => row.enrollmentId === enrollments[3])).toBe(true);
    const late = await db.student.create({ data: { givenNames: 'Posterior', familyNames: 'Prueba' } });
    const enrollment = await db.enrollment.create({ data: { studentId: late.id, courseId, academicYearId: yearId } });
    expect(await db.attendanceRecord.count({ where: { attendanceSessionId: sessionId, enrollmentId: enrollment.id } })).toBe(0);
    expect((await put(recordPath(sessionId, enrollment.id), mark('PRESENTE'))).status).toBe(201);
  });

  it('A-19/A-20: contexto inactivo, sesión y CSRF; historia autorizada', async () => {
    expect((await request(app).get(base())).status).toBe(401);
    expect((await request(app).post(base()).set('Cookie', aCookie).send({ classDate: '2026-05-23' })).body.error.code).toBe('CSRF_TOKEN_INVALID');
    const listed = await get(base());
    expect(listed.headers['cache-control']).toBe('no-store');
    await db.teachingAssignment.update({ where: { id: assignmentId }, data: { endedAt: new Date() } });
    expect((await post(base(), { classDate: '2026-05-23' })).status).toBe(404);
    expect((await get(`${base()}/${sessionId}`, adminCookie)).status).toBe(200);
    await db.teachingAssignment.update({ where: { id: assignmentId }, data: { endedAt: null } });
    await db.course.update({ where: { id: courseId }, data: { isActive: false, disabledAt: new Date(), disabledById: admin.id } });
    expect((await post(base(), { classDate: '2026-05-23' })).status).toBe(409);
    await db.course.update({ where: { id: courseId }, data: { isActive: true, disabledAt: null, disabledById: null } });
    await db.subject.update({ where: { id: subjectId }, data: { isActive: false, disabledAt: new Date(), disabledById: admin.id } });
    expect((await put(recordPath(sessionId, enrollments[9]!), mark('PRESENTE'))).status).toBe(409);
    await db.subject.update({ where: { id: subjectId }, data: { isActive: true, disabledAt: null, disabledById: null } });
    await db.institution.update({ where: { id: institutionId }, data: { isActive: false, disabledAt: new Date(), disabledById: admin.id } });
    expect((await post(base(), { classDate: '2026-05-23' })).status).toBe(409);
    expect((await get(`${base()}/${sessionId}`, adminCookie)).status).toBe(200);
    await db.institution.update({ where: { id: institutionId }, data: { isActive: true, disabledAt: null, disabledById: null } });
  });

  it('A-21: 33 códigos independientes, sincronización idempotente y sin grants demo', async () => {
    expect(PERMISSION_CATALOG).toHaveLength(33);
    expect(PERMISSION_CATALOG.slice(31).map(item => item.code)).toEqual(['attendance.read', 'attendance.manage']);
    for (const item of PERMISSION_CATALOG) await db.permission.upsert({ where: { code: item.code }, create: item, update: { description: item.description } });
    expect(await db.permission.count({ where: { code: { in: ['attendance.read', 'attendance.manage'] } } })).toBe(2);
    expect(await db.roleAssignmentPermission.count({ where: { assignment: { role: { code: 'HITO1_DEMO_INSTITUTION_ADMIN' } }, permission: { code: { in: ['attendance.read', 'attendance.manage'] } } } })).toBe(0);
    expect((await get(`${base()}/${sessionId}`, adminCookie)).status).toBe(200);
    const readGrant = await db.roleAssignmentPermission.findFirstOrThrow({ where: { assignment: { userId: teacherB.id }, permission: { code: 'attendance.read' } } });
    await db.roleAssignmentPermission.update({ where: { id: readGrant.id }, data: { revokedAt: new Date() } });
    expect((await get(`/api/v1/teaching-assignments/${foreignAssignmentId}/attendance-sessions`, bCookie)).status).toBe(403);
    expect((await post(`/api/v1/teaching-assignments/${foreignAssignmentId}/attendance-sessions`, { classDate: '2026-05-24' }, bCookie, bCsrf)).status).toBe(201);
  });

  it('A-22/A-23: filtros inclusivos, paginación contextual, curso/materia e historial real', async () => {
    const filtered = await get(`${base()}?date=2026-05-20&limit=1`);
    expect(filtered.status).toBe(200); expect(filtered.body.data).toHaveLength(1); expect(filtered.body.nextCursor).toBeTruthy();
    const next = await get(`${base()}?date=2026-05-20&limit=1&cursor=${encodeURIComponent(filtered.body.nextCursor)}`);
    expect(next.body.data).toHaveLength(1);
    expect((await get(`${base()}?from=2026-05-20&to=2026-05-20`)).body.data).toHaveLength(2);
    expect((await get(`${base()}?date=2026-05-20&from=2026-05-20`)).status).toBe(400);
    expect((await get(`${base()}?from=2026-05-21&to=2026-05-20`)).status).toBe(400);
    const course = await get(`/api/v1/institutions/${institutionId}/courses/${courseId}/attendance-sessions?subjectId=${subjectId}&date=2026-05-20`);
    expect(course.status).toBe(200); expect(course.body.data).toHaveLength(2);
    const firstCoursePage = await get(`/api/v1/institutions/${institutionId}/courses/${courseId}/attendance-sessions?subjectId=${subjectId}&date=2026-05-20&limit=1`);
    expect(firstCoursePage.body.data).toHaveLength(1); expect(firstCoursePage.body.nextCursor).toBeTruthy();
    expect((await get(`/api/v1/institutions/${institutionId}/courses/${courseId}/attendance-sessions?date=2026-05-20&from=2026-05-20`)).status).toBe(400);
    const history = await get(`/api/v1/institutions/${institutionId}/enrollments/${enrollments[0]}/attendance?assignmentId=${assignmentId}&from=2026-05-20&to=2026-05-20`);
    expect(history.status).toBe(200); expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0]).toMatchObject({ sessionId, classDate: '2026-05-20', assignmentId, enrollmentId: enrollments[0] });
    expect((await get(`/api/v1/institutions/${institutionId}/enrollments/${foreignEnrollmentId}/attendance?assignmentId=${assignmentId}`)).status).toBe(404);
  });
});
