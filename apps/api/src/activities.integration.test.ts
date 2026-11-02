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
const config: AuthConfig = { sessionTtlMs: 28_800_000, lastSeenIntervalMs: 60_000, sessionCookieName: 'edugestor_session', csrfCookieName: 'edugestor_csrf', secureCookies: false, loginRateLimitWindowMs: 900_000, loginRateLimitMaxAttempts: 100, confirmationActiveKid: 'integration', confirmationKeys: { integration: 'integration-confirmation-secret-2b2-00000001' } };
const app = createApp(createDatabaseProbe(db), { logger: pino({ level: 'silent' }), auth: { client: db, config } });
const suffix = randomUUID().slice(0, 8);
let root: User, teacherA: User, teacherB: User, admin: User;
let institutionId: string, otherInstitutionId: string, courseId: string, otherCourseId: string, yearId: string;
let assignmentId: string, secondAssignmentId: string, foreignAssignmentId: string, enrollmentId: string, otherEnrollmentId: string;
let zeroBaseAssignmentId: string;
let aCookie: string, aCsrf: string, bCookie: string, bCsrf: string, adminCookie: string, adminCsrf: string;
const base = () => `/api/v1/teaching-assignments/${assignmentId}`;
const person = (name: string, accountKind = AccountKind.STANDARD) => db.user.create({ data: { login: `${name}-${suffix}`, loginNormalized: `${name}-${suffix}`, passwordHash: 'integration-only', accountKind } });
const grant = async (user: User, institutionId: string, roleId: string, codes: PermissionCode[], course?: string) => {
  const scope = await db.accessScope.create({ data: { institutionId, kind: course ? ScopeKind.COURSE_SET : ScopeKind.INSTITUTION, createdById: root.id, ...(course ? { courses: { create: { courseId: course } } } : {}) } });
  const assignment = await db.roleAssignment.create({ data: { userId: user.id, roleId, scopeId: scope.id, grantedById: root.id } });
  for (const code of codes) { const permission = await db.permission.findUniqueOrThrow({ where: { code } }); await db.roleAssignmentPermission.create({ data: { roleAssignmentId: assignment.id, permissionId: permission.id, delegatedById: root.id } }); }
};
const auth = async (user: User) => {
  const token = createOpaqueSessionToken();
  await db.authSession.create({ data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 3_600_000) } });
  const session = `${config.sessionCookieName}=${token}`;
  const result = await request(app).get('/api/v1/auth/csrf').set('Cookie', session);
  return { cookie: `${session}; ${(result.headers['set-cookie'] as string[])[0]!.split(';')[0]!}`, csrf: result.body.csrfToken as string };
};
const post = (path: string, body: unknown, cookie = aCookie, csrf = aCsrf) => request(app).post(path).set('Cookie', cookie).set('x-csrf-token', csrf).send(body);
const put = (path: string, body: unknown, cookie = aCookie, csrf = aCsrf) => request(app).put(path).set('Cookie', cookie).set('x-csrf-token', csrf).send(body);
const get = (path: string, cookie = aCookie) => request(app).get(path).set('Cookie', cookie);
const newTask = (title: string, maxPoints = '20', scoringKind = 'ORDINARIA') => ({ title, description: 'Contenido original', maxPoints, scoringKind });

describeDatabase('B-01–B-27, checkpoint 2B-1, PostgreSQL real', () => {
  beforeAll(async () => {
    for (const item of PERMISSION_CATALOG) await db.permission.upsert({ where: { code: item.code }, create: item, update: item });
    [root, teacherA, teacherB, admin] = await Promise.all([person('b-root', AccountKind.TECHNICAL), person('b-teacher-a'), person('b-teacher-b'), person('b-admin')]);
    const [institution, other] = await Promise.all([db.institution.create({ data: { name: `B ${suffix}` } }), db.institution.create({ data: { name: `B other ${suffix}` } })]);
    institutionId = institution.id; otherInstitutionId = other.id;
    const [year, otherYear] = await Promise.all([db.academicYear.create({ data: { institutionId, label: `2026-${suffix}`, startsOn: new Date('2026-02-01'), endsOn: new Date('2026-11-30') } }), db.academicYear.create({ data: { institutionId: otherInstitutionId, label: `2026-${suffix}`, startsOn: new Date('2026-02-01'), endsOn: new Date('2026-11-30') } })]);
    yearId = year.id;
    const [course, otherCourse] = await Promise.all([db.course.create({ data: { institutionId, academicYearId: year.id, grade: '1', section: suffix, shift: 'Mañana' } }), db.course.create({ data: { institutionId: otherInstitutionId, academicYearId: otherYear.id, grade: '1', section: suffix, shift: 'Mañana' } })]);
    courseId = course.id; otherCourseId = otherCourse.id;
    const [subject, otherSubject] = await Promise.all([db.subject.create({ data: { institutionId, name: `B ${suffix}`, nameNormalized: `b-${suffix}` } }), db.subject.create({ data: { institutionId: otherInstitutionId, name: `B ${suffix}`, nameNormalized: `b-${suffix}` } })]);
    const [ta, tb] = await Promise.all([db.teacher.create({ data: { userId: teacherA.id, displayName: 'Docente A' } }), db.teacher.create({ data: { userId: teacherB.id, displayName: 'Docente B' } })]);
    await Promise.all([db.teacherInstitution.create({ data: { teacherId: ta.id, institutionId } }), db.teacherInstitution.create({ data: { teacherId: ta.id, institutionId: otherInstitutionId } }), db.teacherInstitution.create({ data: { teacherId: tb.id, institutionId } })]);
    const [a, a2, foreign] = await Promise.all([db.teachingAssignment.create({ data: { teacherId: ta.id, institutionId, courseId, subjectId: subject.id } }), db.teachingAssignment.create({ data: { teacherId: ta.id, institutionId: otherInstitutionId, courseId: otherCourseId, subjectId: otherSubject.id } }), db.teachingAssignment.create({ data: { teacherId: tb.id, institutionId, courseId, subjectId: subject.id } })]);
    assignmentId = a.id; secondAssignmentId = a2.id; foreignAssignmentId = foreign.id;
    const [student, otherStudent] = await Promise.all([db.student.create({ data: { givenNames: 'Ana', familyNames: 'B' } }), db.student.create({ data: { givenNames: 'Bea', familyNames: 'B' } })]);
    const [enrollment, otherEnrollment] = await Promise.all([db.enrollment.create({ data: { studentId: student.id, courseId, academicYearId: year.id } }), db.enrollment.create({ data: { studentId: otherStudent.id, courseId: otherCourseId, academicYearId: otherYear.id } })]);
    enrollmentId = enrollment.id; otherEnrollmentId = otherEnrollment.id;
    const roleId = (await db.role.create({ data: { code: `B-${suffix}`, name: 'B' } })).id;
    const codes: PermissionCode[] = ['activity-bank.read', 'activity-bank.manage', 'task.read', 'task.manage', 'assessment.read', 'assessment.manage', 'assessment-result.read', 'assessment-result.manage', 'enrollment.read', 'student.read', 'grading-scale.read', 'grading-scale.manage', 'teaching-assignment.read', 'teaching-assignment.manage'];
    await grant(teacherA, institutionId, roleId, codes); await grant(teacherA, otherInstitutionId, roleId, codes);
    await grant(teacherB, institutionId, roleId, codes); await grant(admin, institutionId, roleId, codes);
    const [aAuth, bAuth, adminAuth] = await Promise.all([auth(teacherA), auth(teacherB), auth(admin)]);
    aCookie = aAuth.cookie; aCsrf = aAuth.csrf; bCookie = bAuth.cookie; bCsrf = bAuth.csrf; adminCookie = adminAuth.cookie; adminCsrf = adminAuth.csrf;
  });
  afterAll(async () => db.$disconnect());

  it('B-01/02/03/04/05/06/08: actividades únicas, pendiente, cero y cálculo decimal', async () => {
    const task = await post(`${base()}/tasks`, newTask('Ordinaria'));
    expect(task.status).toBe(201);
    let process = await get(`${base()}/process`);
    expect(process.body.data.activities).toHaveLength(1);
    expect(process.body.data.rows[0]).toMatchObject({ ordinaryPossible: '20', ordinaryEarned: '0', pendingCount: 1, isPartial: true, formalGrade: null, formalGradeReason: 'PENDING_RESULTS' });
    expect(await db.assessment.count({ where: { taskId: task.body.data.id } })).toBe(0);
    const first = await put(`${base()}/tasks/${task.body.data.id}/results/${enrollmentId}`, { status: 'EVALUADO', earnedPoints: '0', expectedVersion: null, expectedTaskVersion: 1 });
    expect(first.status).toBe(201); expect(first.body.data.earnedPoints).toBe('0');
    const linked = await db.assessment.findUniqueOrThrow({ where: { taskId: task.body.data.id } });
    expect(linked.standaloneMaxPoints).toBeNull();
    const extra = await post(`${base()}/tasks`, newTask('Extra', '3', 'FUERA_DE_ESCALA'));
    expect(extra.status).toBe(201);
    const independent = await post(`${base()}/assessments`, { title: 'Independiente', description: 'Sin tarea', standaloneMaxPoints: '5', standaloneScoringKind: 'ORDINARIA' });
    expect(independent.status).toBe(201); expect(independent.body.data.taskId).toBeNull();
    process = await get(`${base()}/process`);
    expect(process.body.data.activities).toHaveLength(3);
    expect(process.body.data.rows[0]).toMatchObject({ ordinaryPossible: '25', pendingCount: 2, formalGrade: null });
    const extraResult = await put(`${base()}/tasks/${extra.body.data.id}/results/${enrollmentId}`, { status: 'EVALUADO', earnedPoints: '3', expectedVersion: null, expectedTaskVersion: 1 });
    expect(extraResult.status).toBe(201);
    const indieResult = await put(`${base()}/assessments/${independent.body.data.id}/results/${enrollmentId}`, { status: 'EVALUADO', earnedPoints: '5', expectedVersion: null });
    expect(indieResult.status).toBe(201);
    process = await get(`${base()}/process`);
    expect(process.body.data.rows[0]).toMatchObject({ ordinaryPossible: '25', ordinaryEarned: '5', extraEarned: '3', totalEarned: '8', percentage: '32', pendingCount: 0, formalGrade: null, formalGradeReason: 'NO_VALID_SCALE' });
    const pending = await put(`${base()}/assessments/${independent.body.data.id}/results/${enrollmentId}`, { status: 'PENDIENTE', expectedVersion: 1 });
    expect(pending.status).toBe(200); expect(pending.body.data.earnedPoints).toBeNull();
    expect((await db.assessmentResult.findUniqueOrThrow({ where: { id: pending.body.data.id } })).evaluatedAt).toBeNull();
    expect((await get(`${base()}/process`)).body.data.rows[0].pendingCount).toBe(1);
    const onlyExtra = await post(`${base()}/assessments`, { title: 'Solo extra', standaloneMaxPoints: '1', standaloneScoringKind: 'FUERA_DE_ESCALA' });
    const emptyAssignment = await get(`/api/v1/teaching-assignments/${secondAssignmentId}/process`);
    expect(emptyAssignment.body.data.rows[0]).toMatchObject({ ordinaryPossible: '0', percentage: null, formalGrade: null, formalGradeReason: 'NO_ORDINARY_BASE' });
    expect(onlyExtra.status).toBe(201);
  });

  it('B-10/12: carreras dejan una evaluación vinculada y un único resultado ganador', async () => {
    const task = await post(`${base()}/tasks`, newTask('Carrera'));
    const path = `${base()}/tasks/${task.body.data.id}/results/${enrollmentId}`;
    const body = { status: 'EVALUADO', earnedPoints: '7', expectedVersion: null, expectedTaskVersion: 1 };
    const [left, right] = await Promise.all([put(path, body), put(path, body)]);
    expect([left.status, right.status].sort()).toEqual([201, 409]);
    const linked = await db.assessment.findMany({ where: { taskId: task.body.data.id } });
    expect(linked).toHaveLength(1);
    expect(await db.assessmentResult.count({ where: { assessmentId: linked[0]!.id, enrollmentId } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: 'assessment-result.create', entityType: 'AssessmentResult', entityId: [left, right].find(r => r.status === 201)!.body.data.id } })).toBe(1);
    const updatePath = `${base()}/assessments/${linked[0]!.id}/results/${enrollmentId}`;
    const [updateA, updateB] = await Promise.all([
      put(updatePath, { status: 'EVALUADO', earnedPoints: '8', expectedVersion: 1 }),
      put(updatePath, { status: 'EVALUADO', earnedPoints: '9', expectedVersion: 1 }),
    ]);
    expect([updateA.status, updateB.status].sort()).toEqual([200, 409]);
    const final = await db.assessmentResult.findUniqueOrThrow({ where: { assessmentId_enrollmentId: { assessmentId: linked[0]!.id, enrollmentId } } });
    expect(final.rowVersion).toBe(2);
    expect(final.earnedPoints?.toString()).toBe([updateA, updateB].find(row => row.status === 200)!.body.data.earnedPoints);
  });

  it('B-11/19: contexto de matrícula, unicidad, checks y vinculación estricta', async () => {
    const task = await post(`${base()}/tasks`, newTask('Vincular', '4'));
    const assessment = await post(`${base()}/assessments`, { title: 'Instrumento', standaloneMaxPoints: '4', standaloneScoringKind: 'ORDINARIA' });
    expect((await post(`${base()}/assessments/${assessment.body.data.id}/link-task`, { taskId: task.body.data.id, expectedVersion: 1 })).status).toBe(200);
    expect((await post(`${base()}/assessments`, { title: 'Duplicada', taskId: task.body.data.id })).status).toBe(409);
    expect((await put(`${base()}/tasks/${task.body.data.id}/results/${otherEnrollmentId}`, { status: 'EVALUADO', earnedPoints: '1', expectedVersion: null, expectedTaskVersion: 1 })).status).toBe(422);
    await expect(db.assessmentResult.create({ data: { assessmentId: assessment.body.data.id, enrollmentId: otherEnrollmentId, status: 'EVALUADO', earnedPoints: '1', evaluatedAt: new Date(), evaluatedById: teacherA.id } })).rejects.toThrow();
    expect((await request(app).patch(`${base()}/tasks/${task.body.data.id}`).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ scoringKind: 'FUERA_DE_ESCALA', expectedVersion: 1 })).status).toBe(400);
    const independent = await post(`${base()}/assessments`, { title: 'Con resultado', standaloneMaxPoints: '4', standaloneScoringKind: 'ORDINARIA' });
    const recorded = await put(`${base()}/assessments/${independent.body.data.id}/results/${enrollmentId}`, { status: 'EVALUADO', earnedPoints: '2', expectedVersion: null });
    expect(recorded.status).toBe(201);
    const freeTask = await post(`${base()}/tasks`, newTask('Libre', '4'));
    expect((await post(`${base()}/assessments/${independent.body.data.id}/link-task`, { taskId: freeTask.body.data.id, expectedVersion: 1 })).status).toBe(409);
    expect((await put(`${base()}/tasks/${task.body.data.id}/results/${enrollmentId}`, { status: 'EVALUADO', earnedPoints: '2', expectedVersion: null, expectedTaskVersion: 1 })).status).toBe(201);
    await expect(db.task.update({ where: { id: task.body.data.id }, data: { maxPoints: '1' } })).rejects.toThrow();
    await expect(db.task.update({ where: { id: freeTask.body.data.id }, data: { teachingAssignmentId: secondAssignmentId } })).rejects.toThrow();
  });

  it('B-13/14/15/22: banco privado, copia independiente y aislamiento contextual', async () => {
    const bankPath = `/api/v1/institutions/${institutionId}/me/activity-bank/items`;
    const item = await post(bankPath, { kind: 'TASK', title: 'Plantilla A', description: 'Original', scoringKind: 'ORDINARIA', suggestedMaxPoints: '8' });
    expect(item.status).toBe(201);
    expect((await get(`${bankPath}/${item.body.data.id}`, bCookie)).status).toBe(404);
    expect((await get(`${bankPath}/${item.body.data.id}`, adminCookie)).status).toBe(404);
    expect((await post(`${base()}/tasks`, { ...newTask('Copia', '8'), sourceBankItemId: item.body.data.id }, bCookie, bCsrf)).status).toBe(404);
    const copy = await post(`${base()}/tasks`, { ...newTask('Copia', '8'), sourceBankItemId: item.body.data.id });
    expect(copy.status).toBe(201);
    const reused = await post(`${base()}/tasks/${copy.body.data.id}/reuse`, { targetAssignmentId: secondAssignmentId });
    expect(reused.status).toBe(201); expect(reused.body.data.sourceTaskId).toBe(copy.body.data.id);
    expect((await get(`${base()}/tasks/${copy.body.data.id}`, bCookie)).status).toBe(404);
    expect((await get(`/api/v1/teaching-assignments/${foreignAssignmentId}/tasks/${copy.body.data.id}`, bCookie)).status).toBe(404);
    const changed = await request(app).patch(`${bankPath}/${item.body.data.id}`).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ title: 'Nuevo origen', expectedVersion: 1 });
    expect(changed.status).toBe(200);
    expect((await get(`${base()}/tasks/${copy.body.data.id}`)).body.data.title).toBe('Plantilla A');
    expect((await post(`${base()}/tasks/${copy.body.data.id}/reuse`, { targetAssignmentId: foreignAssignmentId })).status).toBe(404);
    expect((await get(`${base()}/tasks`)).status).toBe(200);
    expect((await request(app).post(`${base()}/tasks`).set('Cookie', aCookie).send(newTask('Sin CSRF'))).status).toBe(403);
    expect((await request(app).get(`${base()}/tasks`)).status).toBe(401);
  });

  it('B-08/14/15: extras sin base, reutilización de evaluación y vínculo cruzado rechazado', async () => {
    const teacher = await db.teacher.findUniqueOrThrow({ where: { userId: teacherA.id } });
    const subject = await db.subject.create({ data: { institutionId: otherInstitutionId, name: `Cero ${suffix}`, nameNormalized: `cero-${suffix}` } });
    zeroBaseAssignmentId = (await db.teachingAssignment.create({ data: { teacherId: teacher.id, institutionId: otherInstitutionId, courseId: otherCourseId, subjectId: subject.id } })).id;
    const foreignBase = `/api/v1/teaching-assignments/${zeroBaseAssignmentId}`;
    const extra = await post(`${foreignBase}/assessments`, { title: 'Extra solo', description: 'Instrumento', standaloneMaxPoints: '3', standaloneScoringKind: 'FUERA_DE_ESCALA', instrumentContent: 'Preguntas A' });
    expect(extra.status).toBe(201);
    const result = await put(`${foreignBase}/assessments/${extra.body.data.id}/results/${otherEnrollmentId}`, { status: 'EVALUADO', earnedPoints: '3', expectedVersion: null });
    expect(result.status).toBe(201);
    const process = await get(`${foreignBase}/process`);
    expect(process.body.data.rows[0]).toMatchObject({ ordinaryPossible: '0', extraEarned: '3', totalEarned: '3', percentage: null, pendingCount: 0, formalGrade: null, formalGradeReason: 'NO_ORDINARY_BASE' });
    const reused = await post(`${foreignBase}/assessments/${extra.body.data.id}/reuse`, { targetAssignmentId: assignmentId });
    expect(reused.status).toBe(201);
    expect(reused.body.data).toMatchObject({ taskId: null, sourceAssessmentId: extra.body.data.id, instrumentContent: 'Preguntas A', standaloneMaxPoints: '3', standaloneScoringKind: 'FUERA_DE_ESCALA' });
    expect(await db.assessmentResult.count({ where: { assessmentId: reused.body.data.id } })).toBe(0);
    const patched = await request(app).patch(`${foreignBase}/assessments/${extra.body.data.id}`).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ instrumentContent: 'Preguntas B', expectedVersion: 1 });
    expect(patched.status).toBe(200);
    expect((await get(`${base()}/assessments/${reused.body.data.id}`)).body.data.instrumentContent).toBe('Preguntas A');
    const task = await post(`${base()}/tasks`, newTask('Local'));
    expect((await post(`${foreignBase}/assessments/${extra.body.data.id}/link-task`, { taskId: task.body.data.id, expectedVersion: 2 })).status).toBe(404);
    expect((await post(`${base()}/assessments/${reused.body.data.id}/link-task`, { taskId: task.body.data.id, expectedVersion: 1 })).status).toBe(200);
  });

  it('B-02/07 parcial: porcentaje interno puede exceder 100 sin nota formal', async () => {
    const ordinary = await post(`/api/v1/teaching-assignments/${zeroBaseAssignmentId}/tasks`, newTask('Base cien', '20'));
    expect((await put(`/api/v1/teaching-assignments/${zeroBaseAssignmentId}/tasks/${ordinary.body.data.id}/results/${otherEnrollmentId}`, { status: 'EVALUADO', earnedPoints: '20', expectedVersion: null, expectedTaskVersion: 1 })).status).toBe(201);
    const process = await get(`/api/v1/teaching-assignments/${zeroBaseAssignmentId}/process`);
    expect(process.body.data.rows[0].percentage).toBe('115');
    expect(process.body.data.rows[0].formalGrade).toBeNull();
  });

  it('B-07/09/16/17/18/21: escala versionada y cambios confirmados preservan resultados', async () => {
    const teacher = await db.teacher.findUniqueOrThrow({ where: { userId: teacherA.id } });
    const subject = await db.subject.create({ data: { institutionId, name: `Escala ${suffix}`, nameNormalized: `escala-${suffix}` } });
    const assignment = await db.teachingAssignment.create({ data: { teacherId: teacher.id, institutionId, courseId, subjectId: subject.id } });
    const path = `/api/v1/teaching-assignments/${assignment.id}`;
    const scalePath = `/api/v1/institutions/${institutionId}/grading-scales`;
    const definition = (top: string) => ({ minimumGrade: '1', maximumGrade: top, conversionDefinition: { schemaVersion: 1, kind: 'PERCENTAGE_BANDS', bands: [{ fromPercent: '0', grade: '1' }, { fromPercent: '60', grade: '3' }, { fromPercent: '90', grade: top }] }, roundingDefinition: { schemaVersion: 1, kind: 'NONE' } });
    const scale = await post(scalePath, { name: `Escala ${suffix}`, version: 1, ...definition('5') });
    expect(scale.status).toBe(201);
    expect((await post(scalePath, { name: `Inválida ${suffix}`, version: 1, ...definition('5'), conversionDefinition: { schemaVersion: 1, kind: 'PERCENTAGE_BANDS', bands: [{ fromPercent: '1', grade: '1' }] } })).status).toBe(422);
    const task = await post(`${path}/tasks`, newTask('Base 2B-2', '20'));
    const extra = await post(`${path}/tasks`, newTask('Adicional 2B-2', '3', 'FUERA_DE_ESCALA'));
    expect((await put(`${path}/tasks/${task.body.data.id}/results/${enrollmentId}`, { status: 'EVALUADO', earnedPoints: '20', expectedVersion: null, expectedTaskVersion: 1 })).status).toBe(201);
    expect((await put(`${path}/tasks/${extra.body.data.id}/results/${enrollmentId}`, { status: 'EVALUADO', earnedPoints: '3', expectedVersion: null, expectedTaskVersion: 1 })).status).toBe(201);
    expect((await get(`${path}/process`)).body.data.rows[0]).toMatchObject({ percentage: '115', formalGrade: null, formalGradeReason: 'NO_VALID_SCALE' });
    const preview = await post(`${path}/grading-scale/change-preview`, { newGradingScaleId: scale.body.data.id, expectedAssignmentVersion: 1 });
    expect(preview.status).toBe(200);
    expect((await get(`${path}/grading-scale`, bCookie)).status).toBe(404);
    const apply = await put(`${path}/grading-scale`, { newGradingScaleId: scale.body.data.id, expectedAssignmentVersion: 1, confirmationToken: preview.body.data.confirmationToken });
    expect(apply.status).toBe(200);
    expect((await put(`${path}/grading-scale`, { newGradingScaleId: scale.body.data.id, expectedAssignmentVersion: 1, confirmationToken: preview.body.data.confirmationToken })).status).toBe(409);
    expect((await get(`${path}/process`)).body.data.rows[0]).toMatchObject({ percentage: '115', formalGrade: '5', formalGradeReason: null });
    expect((await db.gradingScale.findUniqueOrThrow({ where: { id: scale.body.data.id } })).lockedAt).not.toBeNull();
    await expect(db.gradingScale.update({ where: { id: scale.body.data.id }, data: { maximumGrade: '6' } })).rejects.toThrow();
    await expect(db.gradingScale.update({ where: { id: scale.body.data.id }, data: { lockedAt: null } })).rejects.toThrow();
    const next = await post(`${scalePath}/${scale.body.data.id}/versions`, { version: 2, expectedVersion: 1, ...definition('4') });
    expect(next.status).toBe(201);
    const stalePreview = await post(`${path}/grading-scale/change-preview`, { newGradingScaleId: next.body.data.id, expectedAssignmentVersion: 2 });
    expect(stalePreview.status).toBe(200);
    expect((await put(`${path}/tasks/${task.body.data.id}/results/${enrollmentId}`, { status: 'EVALUADO', earnedPoints: '19', expectedVersion: 1, expectedTaskVersion: 1 })).status).toBe(200);
    expect((await put(`${path}/grading-scale`, { newGradingScaleId: next.body.data.id, expectedAssignmentVersion: 2, confirmationToken: stalePreview.body.data.confirmationToken })).status).toBe(409);
    const freshPreview = await post(`${path}/grading-scale/change-preview`, { newGradingScaleId: next.body.data.id, expectedAssignmentVersion: 2 });
    expect((await put(`${path}/grading-scale`, { newGradingScaleId: next.body.data.id, expectedAssignmentVersion: 2, confirmationToken: freshPreview.body.data.confirmationToken })).status).toBe(200);
    expect((await get(`${path}/process`)).body.data.rows[0].formalGrade).toBe('4');
    const maxPreview = await post(`${path}/tasks/${task.body.data.id}/max-points/preview`, { newMaxPoints: '10', expectedVersion: 1 });
    expect(maxPreview.status).toBe(200);
    expect(maxPreview.body.data.warnings.length).toBeGreaterThan(0);
    expect((await request(app).patch(`${path}/tasks/${task.body.data.id}/max-points`).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ newMaxPoints: '10', expectedVersion: 1 })).body.error.code).toBe('CONFIRMATION_REQUIRED');
    expect((await request(app).patch(`${path}/tasks/${task.body.data.id}/max-points`).set('Cookie', aCookie).set('x-csrf-token', aCsrf).send({ newMaxPoints: '10', expectedVersion: 1, confirmationToken: maxPreview.body.data.confirmationToken })).status).toBe(200);
    expect((await db.assessmentResult.findFirstOrThrow({ where: { assessment: { taskId: task.body.data.id } } })).earnedPoints?.toString()).toBe('19');
    expect((await get(`${path}/process`)).body.data.rows[0]).toMatchObject({ ordinaryPossible: '10', percentage: '220', formalGrade: '4' });
    expect((await put(`${path}/tasks/${task.body.data.id}/results/${enrollmentId}`, { status: 'EVALUADO', earnedPoints: '11', expectedVersion: 2, expectedTaskVersion: 2 })).status).toBe(422);
    expect(await db.auditLog.count({ where: { entityId: assignment.id, action: 'teaching-assignment.grading-scale.change' } })).toBe(2);
  });

  it('B-22: permisos nuevos independientes y sin concesiones al demo', async () => {
    const newCodes = ['activity-bank.read', 'activity-bank.manage', 'task.read', 'task.manage', 'assessment.read', 'assessment.manage', 'assessment-result.read', 'assessment-result.manage'];
    expect(PERMISSION_CATALOG.slice(0, 21)).toHaveLength(21);
    expect(PERMISSION_CATALOG.slice(21, 29).map(item => item.code)).toEqual(newCodes);
    expect(PERMISSION_CATALOG.slice(29).map(item => item.code)).toEqual(['grading-scale.read', 'grading-scale.manage']);
    expect(await db.roleAssignmentPermission.count({ where: { assignment: { role: { code: 'HITO1_DEMO_INSTITUTION_ADMIN' } }, permission: { code: { in: newCodes } } } })).toBe(0);
    const grant = await db.roleAssignmentPermission.findFirstOrThrow({ where: { assignment: { userId: teacherB.id }, permission: { code: 'task.manage' } } });
    await db.roleAssignmentPermission.update({ where: { id: grant.id }, data: { revokedAt: new Date() } });
    const attempted = await post(`/api/v1/teaching-assignments/${foreignAssignmentId}/tasks`, newTask('Sin manage'), bCookie, bCsrf);
    expect(attempted.status).toBe(403);
    expect((await get(`/api/v1/teaching-assignments/${foreignAssignmentId}/tasks`, bCookie)).status).toBe(200);
  });

  it('B-20: inactividad bloquea escritura sin borrar resultado previo', async () => {
    const task = await post(`${base()}/tasks`, newTask('Historia'));
    const result = await put(`${base()}/tasks/${task.body.data.id}/results/${enrollmentId}`, { status: 'EVALUADO', earnedPoints: '4', expectedVersion: null, expectedTaskVersion: 1 });
    expect(result.status).toBe(201);
    const enrollment = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
    await db.student.update({ where: { id: enrollment.studentId }, data: { isActive: false, disabledAt: new Date(), disabledById: admin.id } });
    expect((await put(`${base()}/tasks/${task.body.data.id}/results/${enrollmentId}`, { status: 'EVALUADO', earnedPoints: '5', expectedVersion: 1, expectedTaskVersion: 1 })).status).toBe(409);
    expect((await get(`${base()}/process`)).body.data.rows[0].results.some((row: { earnedPoints: string | null }) => row.earnedPoints === '4')).toBe(true);
    await db.student.update({ where: { id: enrollment.studentId }, data: { isActive: true, disabledAt: null, disabledById: null } });
    await db.course.update({ where: { id: courseId }, data: { isActive: false, disabledAt: new Date(), disabledById: admin.id } });
    expect((await put(`${base()}/tasks/${task.body.data.id}/results/${enrollmentId}`, { status: 'EVALUADO', earnedPoints: '5', expectedVersion: 1, expectedTaskVersion: 1 })).status).toBe(404);
    await db.course.update({ where: { id: courseId }, data: { isActive: true, disabledAt: null, disabledById: null } });
    await db.institution.update({ where: { id: institutionId }, data: { isActive: false, disabledAt: new Date(), disabledById: admin.id } });
    expect((await get(`${base()}/process`)).status).toBe(404);
    await db.institution.update({ where: { id: institutionId }, data: { isActive: true, disabledAt: null, disabledById: null } });
    await db.teachingAssignment.update({ where: { id: assignmentId }, data: { endedAt: new Date() } });
    expect((await get(`${base()}/process`)).status).toBe(404);
    await db.teachingAssignment.update({ where: { id: assignmentId }, data: { endedAt: null } });
    const teacher = await db.teacher.findUniqueOrThrow({ where: { userId: teacherA.id } });
    await db.teacher.update({ where: { id: teacher.id }, data: { isActive: false, disabledAt: new Date(), disabledById: admin.id } });
    expect((await get(`${base()}/process`)).status).toBe(401);
    await db.teacher.update({ where: { id: teacher.id }, data: { isActive: true, disabledAt: null, disabledById: null } });
    const fresh = await auth(teacherA);
    expect((await get(`${base()}/process`, fresh.cookie)).body.data.rows[0].results.some((row: { earnedPoints: string | null }) => row.earnedPoints === '4')).toBe(true);
  });
});
