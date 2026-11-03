import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { PERMISSION_CATALOG } from '../apps/api/src/modules/authorization/permission-catalog';
import { hashPassword } from '../apps/api/src/security/password';

const requireFromApi = createRequire(resolve(process.cwd(), 'apps/api/package.json'));
const gradingDatabaseUrl = process.env.E2E_GRADING_DATABASE_URL ?? process.env.DATABASE_URL;
const { AccountKind, PrismaClient, ScopeKind } = requireFromApi('@prisma/client') as {
  AccountKind: { TECHNICAL: 'TECHNICAL' }; ScopeKind: { INSTITUTION: 'INSTITUTION' };
  PrismaClient: new (options?: { datasources?: { db?: { url?: string } } }) => import('../apps/api/node_modules/@prisma/client').PrismaClient;
};
const db = new PrismaClient({ datasources: { db: { url: gradingDatabaseUrl } } });
const suffix = randomUUID().slice(0, 8);
const login = `grading.e2e.${suffix}`, password = `G-${randomUUID()}`;
const secret = randomBytes(48).toString('base64url'), keyJson = JSON.stringify({ cross_instance: secret });
const started: ChildProcessWithoutNullStreams[] = [];
let logs = '', apiA = '', apiB = '', web = '';
let institutionId = '', courseId = '', yearId = '', actorUserId = '', uiAssignmentId = '', tokenAssignmentId = '', uiTaskId = '', tokenTaskId = '', uiAssessmentId = '', tokenAssessmentId = '', enrollmentId = '';

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const address = server.address(); const port = typeof address === 'object' && address ? address.port : 0; server.close(() => resolvePort(port)); });
  });
}
function launch(file: string, args: string[], cwd: string, environment: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, [file, ...args], { cwd, env: { ...process.env, ...environment }, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (data: Buffer) => { logs += data.toString('utf8'); });
  started.push(child);
  return child;
}
async function ready(url: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const response = await fetch(url); if (response.ok) return; } catch { /* startup */ }
    await new Promise(done => setTimeout(done, 150));
  }
  throw new Error(`Servicio no disponible: ${url}; salida de procesos: ${logs.slice(-2000)}`);
}
const base = (assignmentId: string) => `/api/v1/teaching-assignments/${assignmentId}`;

test.beforeAll(async () => {
  if (!gradingDatabaseUrl?.includes('edugestor_hito2b2_validation_') || gradingDatabaseUrl === process.env.DATABASE_URL && process.env.E2E_GRADING_DATABASE_URL) throw new Error('El E2E exige una base PostgreSQL temporal exclusiva');
  const [aPort, bPort, webPort] = await Promise.all([freePort(), freePort(), freePort()]);
  apiA = `http://127.0.0.1:${aPort}`; apiB = `http://127.0.0.1:${bPort}`; web = `http://127.0.0.1:${webPort}`;
  for (const item of PERMISSION_CATALOG) await db.permission.upsert({ where: { code: item.code }, create: item, update: { description: item.description } });
  const technical = await db.user.create({ data: { login: `grading.tech.${suffix}`, loginNormalized: `grading.tech.${suffix}`, passwordHash: await hashPassword(`T-${randomUUID()}`), accountKind: AccountKind.TECHNICAL } });
  const user = await db.user.create({ data: { login, loginNormalized: login, passwordHash: await hashPassword(password) } });
  actorUserId = user.id;
  const institution = await db.institution.create({ data: { name: `Grading E2E ${suffix}` } }); institutionId = institution.id;
  const year = await db.academicYear.create({ data: { institutionId, label: `2026-${suffix}`, startsOn: new Date('2026-02-01'), endsOn: new Date('2026-11-30') } }); yearId = year.id;
  const course = await db.course.create({ data: { institutionId, academicYearId: yearId, grade: '1.º', section: suffix, shift: 'Mañana' } }); courseId = course.id;
  const [uiSubject, tokenSubject] = await Promise.all([
    db.subject.create({ data: { institutionId, name: `Materia UI ${suffix}`, nameNormalized: `grading-ui-${suffix}` } }),
    db.subject.create({ data: { institutionId, name: `Materia token ${suffix}`, nameNormalized: `grading-token-${suffix}` } }),
  ]);
  const teacher = await db.teacher.create({ data: { userId: user.id, displayName: `Docente ${suffix}` } });
  await db.teacherInstitution.create({ data: { teacherId: teacher.id, institutionId } });
  const [uiAssignment, tokenAssignment] = await Promise.all([
    db.teachingAssignment.create({ data: { teacherId: teacher.id, institutionId, courseId, subjectId: uiSubject.id } }),
    db.teachingAssignment.create({ data: { teacherId: teacher.id, institutionId, courseId, subjectId: tokenSubject.id } }),
  ]);
  uiAssignmentId = uiAssignment.id; tokenAssignmentId = tokenAssignment.id;
  const student = await db.student.create({ data: { givenNames: 'Ana', familyNames: `Grading ${suffix}` } });
  enrollmentId = (await db.enrollment.create({ data: { studentId: student.id, courseId, academicYearId: yearId } })).id;
  const [uiTask, tokenTask] = await Promise.all([
    db.task.create({ data: { teachingAssignmentId: uiAssignmentId, title: `Tarea UI ${suffix}`, description: 'Actividad real', maxPoints: '20', scoringKind: 'ORDINARIA', createdById: user.id } }),
    db.task.create({ data: { teachingAssignmentId: tokenAssignmentId, title: `Tarea token ${suffix}`, description: 'Actividad real', maxPoints: '20', scoringKind: 'ORDINARIA', createdById: user.id } }),
  ]);
  uiTaskId = uiTask.id; tokenTaskId = tokenTask.id;
  for (const [taskId, assignmentId] of [[uiTaskId, uiAssignmentId], [tokenTaskId, tokenAssignmentId]]) {
    const assessment = await db.assessment.create({ data: { teachingAssignmentId: assignmentId, taskId, title: 'Evaluación vinculada', createdById: user.id } });
    if (assignmentId === tokenAssignmentId) tokenAssessmentId = assessment.id;
    else uiAssessmentId = assessment.id;
    await db.assessmentResult.create({ data: { assessmentId: assessment.id, enrollmentId, status: 'EVALUADO', earnedPoints: '20', evaluatedAt: new Date(), evaluatedById: user.id } });
  }
  const role = await db.role.create({ data: { code: `GRADING-E2E-${suffix}`, name: 'Grading E2E' } });
  const scope = await db.accessScope.create({ data: { institutionId, kind: ScopeKind.INSTITUTION, createdById: technical.id } });
  const grant = await db.roleAssignment.create({ data: { userId: user.id, roleId: role.id, scopeId: scope.id, grantedById: technical.id } });
  const codes = ['institution.read', 'course.read', 'teaching-assignment.read', 'teaching-assignment.manage', 'task.read', 'task.manage', 'assessment.read', 'assessment-result.read', 'assessment-result.manage', 'enrollment.read', 'student.read', 'grading-scale.read', 'grading-scale.manage'];
  const permissions = await db.permission.findMany({ where: { code: { in: codes } } });
  await db.roleAssignmentPermission.createMany({ data: permissions.map(item => ({ roleAssignmentId: grant.id, permissionId: item.id, delegatedById: technical.id })) });
  const shared = { DATABASE_URL: gradingDatabaseUrl, NODE_ENV: 'test', LOG_LEVEL: 'info', CORS_ALLOWED_ORIGINS: web, CONFIRMATION_HMAC_KEYS: keyJson, CONFIRMATION_ACTIVE_KID: 'cross_instance' };
  const a = launch(resolve('apps/api/dist/index.js'), [], resolve('apps/api'), { ...shared, API_PORT: String(aPort) });
  const b = launch(resolve('apps/api/dist/index.js'), [], resolve('apps/api'), { ...shared, API_PORT: String(bPort) });
  expect(a.pid).not.toBe(b.pid);
  await Promise.all([ready(`${apiA}/health`), ready(`${apiB}/health`)]);
  launch(resolve('node_modules/vite/bin/vite.js'), ['--host', '127.0.0.1', '--port', String(webPort), '--configLoader', 'runner'], resolve('apps/web'), { VITE_API_URL: apiA });
  await ready(web);
});
test.afterAll(async () => {
  for (const child of started.reverse()) child.kill();
  await db.$disconnect();
});

test('B-18 y B-23/24: token entre dos API y UI real de escala, nota y máximo', async ({ page, request }) => {
  const loginResponse = await request.post(`${apiA}/api/v1/auth/login`, { data: { login, password } });
  expect(loginResponse.status()).toBe(200);
  const csrfResponse = await request.get(`${apiA}/api/v1/auth/csrf`);
  expect(csrfResponse.status()).toBe(200);
  const csrf = (await csrfResponse.json()).csrfToken as string;
  const mutate = async (origin: string, path: string, method: 'POST' | 'PATCH', data: object) => request.fetch(`${origin}${path}`, { method, data, headers: { 'x-csrf-token': csrf } });
  const taskPath = `${base(tokenAssignmentId)}/tasks/${tokenTaskId}/max-points`;
  expect((await request.get(`${apiB}${base(tokenAssignmentId)}/tasks/${tokenTaskId}`)).status()).toBe(200);
  const preview = await mutate(apiA, `${taskPath}/preview`, 'POST', { newMaxPoints: '25', expectedVersion: 1 });
  expect(preview.status()).toBe(200);
  const token = (await preview.json()).data.confirmationToken as string;
  const confirmed = await mutate(apiB, taskPath, 'PATCH', { newMaxPoints: '25', expectedVersion: 1, confirmationToken: token });
  expect(confirmed.status()).toBe(200);
  expect((await db.task.findUniqueOrThrow({ where: { id: tokenTaskId } })).maxPoints.toString()).toBe('25');
  expect((await (await request.get(`${apiA}${base(tokenAssignmentId)}/tasks/${tokenTaskId}`)).json()).data.maxPoints).toBe('25');
  const replay = await mutate(apiB, taskPath, 'PATCH', { newMaxPoints: '25', expectedVersion: 1, confirmationToken: token });
  expect(replay.status()).toBe(409);
  expect((await replay.json()).error.code).toBe('STALE_VERSION');

  const staleTokens: string[] = [];
  const issue = async () => {
    const response = await mutate(apiA, `${taskPath}/preview`, 'POST', { newMaxPoints: '30', expectedVersion: 2 });
    expect(response.status()).toBe(200);
    const value = (await response.json()).data.confirmationToken as string;
    staleTokens.push(value); return value;
  };
  const rejectStale = async (value: string) => {
    const response = await mutate(apiB, taskPath, 'PATCH', { newMaxPoints: '30', expectedVersion: 2, confirmationToken: value });
    expect(response.status()).toBe(409);
    expect((await response.json()).error.code).toBe('STALE_PREVIEW');
    expect((await db.task.findUniqueOrThrow({ where: { id: tokenTaskId } })).maxPoints.toString()).toBe('25');
  };
  const resultToken = await issue();
  await db.assessmentResult.updateMany({ where: { assessmentId: tokenAssessmentId, enrollmentId }, data: { earnedPoints: '19', rowVersion: { increment: 1 } } });
  await rejectStale(resultToken);
  const enrollmentToken = await issue();
  const nextStudent = await db.student.create({ data: { givenNames: 'Bea', familyNames: `Grading ${suffix}` } });
  const nextEnrollment = await db.enrollment.create({ data: { studentId: nextStudent.id, courseId, academicYearId: yearId } });
  await db.assessmentResult.create({ data: { assessmentId: uiAssessmentId, enrollmentId: nextEnrollment.id, status: 'EVALUADO', earnedPoints: '20', evaluatedAt: new Date(), evaluatedById: actorUserId } });
  await rejectStale(enrollmentToken);
  const contextToken = await issue();
  await db.task.create({ data: { teachingAssignmentId: tokenAssignmentId, title: 'Nueva actividad', description: 'Cambio del conjunto', maxPoints: '1', scoringKind: 'FUERA_DE_ESCALA', createdById: actorUserId } });
  await rejectStale(contextToken);

  await page.goto(`${web}/login`);
  await page.getByLabel('Usuario').fill(login);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar a EduGestor' }).click();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await page.goto(`${web}/teacher/institutions/${institutionId}/courses/${courseId}/assignments/${uiAssignmentId}/process`);
  await expect(page.getByRole('heading', { name: 'Escala de calificación' })).toBeVisible();
  const scaleForm = page.getByRole('heading', { name: 'Crear versión de escala' }).locator('..');
  const scaleName = `Escala real ${suffix}`;
  await scaleForm.getByLabel('Nombre (escala nueva)').fill(scaleName);
  await scaleForm.getByLabel('Nota mínima').fill('1');
  await scaleForm.getByLabel('Nota máxima').fill('5');
  await scaleForm.getByLabel('Conversión JSON').fill(JSON.stringify({ schemaVersion: 1, kind: 'PERCENTAGE_BANDS', bands: [{ fromPercent: '0', grade: '1' }, { fromPercent: '60', grade: '3' }, { fromPercent: '90', grade: '5' }] }));
  await scaleForm.getByLabel('Redondeo JSON').fill(JSON.stringify({ schemaVersion: 1, kind: 'NONE' }));
  await scaleForm.getByRole('button', { name: 'Guardar versión' }).click();
  await expect(page.getByText('Versión de escala guardada.')).toBeVisible();
  await page.getByLabel('Versión disponible').selectOption({ label: `${scaleName} · versión 1` });
  const scalePreviewResponse = page.waitForResponse(response => response.url().endsWith('/grading-scale/change-preview') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Vista previa del cambio de escala' }).click();
  const scaleToken = (await (await scalePreviewResponse).json()).data.confirmationToken as string;
  await expect(page.getByText('2 matrículas afectadas.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar escala' }).click();
  await expect(page.getByText('Proceso completo con nota formal').first()).toBeVisible();
  await expect(page.locator('dt', { hasText: 'Nota formal' }).first().locator('xpath=following-sibling::dd')).toHaveText('5');
  await page.getByRole('link', { name: 'Tareas y Evaluaciones' }).click();
  await expect(page.getByText(`Tarea UI ${suffix}`)).toBeVisible();
  await page.getByText(`Tarea UI ${suffix}`).locator('..').getByRole('button', { name: 'Cambiar máximo' }).click();
  await page.getByLabel('Nuevo máximo').fill('40');
  const maxPreviewResponse = page.waitForResponse(response => response.url().endsWith('/max-points/preview') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Vista previa' }).click();
  const maxToken = (await (await maxPreviewResponse).json()).data.confirmationToken as string;
  await expect(page.getByRole('button', { name: 'Confirmar cambio' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar cambio' }).click();
  await page.getByRole('link', { name: 'Ver Proceso' }).click();
  await expect(page.locator('dt', { hasText: 'Puntos ordinarios posibles' }).first().locator('xpath=following-sibling::dd')).toHaveText('40');
  await expect(page.locator('dt', { hasText: 'Nota formal' }).first().locator('xpath=following-sibling::dd')).toHaveText('1');

  await new Promise(done => setTimeout(done, 500));
  for (const sensitive of [secret, keyJson, token, ...staleTokens, scaleToken, maxToken]) expect(logs).not.toContain(sensitive);
  expect((await db.task.findUniqueOrThrow({ where: { id: uiTaskId } })).maxPoints.toString()).toBe('40');
});
