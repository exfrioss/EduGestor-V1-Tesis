import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { PERMISSION_CATALOG } from '../apps/api/src/modules/authorization/permission-catalog';
import { hashPassword } from '../apps/api/src/security/password';

const requireFromApi = createRequire(resolve(process.cwd(), 'apps/api/package.json'));
const { AccountKind, PrismaClient, ScopeKind } = requireFromApi('@prisma/client') as {
  AccountKind: { TECHNICAL: 'TECHNICAL' }; ScopeKind: { COURSE_SET: 'COURSE_SET' };
  PrismaClient: new () => import('../apps/api/node_modules/@prisma/client').PrismaClient;
};
const db = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const login = `a.e2e.teacher.${suffix}`;
const password = `A-${randomUUID()}`;
let institutionId: string, courseId: string, assignmentId: string, otherAssignmentId: string, enrollmentId: string;

test.beforeAll(async () => {
  for (const item of PERMISSION_CATALOG) await db.permission.upsert({ where: { code: item.code }, create: item, update: { description: item.description } });
  const [technical, user, otherUser] = await Promise.all([
    db.user.create({ data: { login: `a.e2e.tech.${suffix}`, loginNormalized: `a.e2e.tech.${suffix}`, passwordHash: await hashPassword(`T-${randomUUID()}`), accountKind: AccountKind.TECHNICAL } }),
    db.user.create({ data: { login, loginNormalized: login, passwordHash: await hashPassword(password) } }),
    db.user.create({ data: { login: `a.e2e.other.${suffix}`, loginNormalized: `a.e2e.other.${suffix}`, passwordHash: await hashPassword(`O-${randomUUID()}`) } }),
  ]);
  const institution = await db.institution.create({ data: { name: `A E2E ${suffix}` } }); institutionId = institution.id;
  const year = await db.academicYear.create({ data: { institutionId, label: `2026-${suffix}`, startsOn: new Date('2026-02-01'), endsOn: new Date('2026-11-30') } });
  const course = await db.course.create({ data: { institutionId, academicYearId: year.id, grade: '1.º', section: suffix, shift: 'Mañana' } }); courseId = course.id;
  const subject = await db.subject.create({ data: { institutionId, name: `Asistencia ${suffix}`, nameNormalized: `asistencia-${suffix}` } });
  const [teacher, otherTeacher] = await Promise.all([db.teacher.create({ data: { userId: user.id, displayName: `Docente ${suffix}` } }), db.teacher.create({ data: { userId: otherUser.id, displayName: `Otro ${suffix}` } })]);
  await Promise.all([db.teacherInstitution.create({ data: { teacherId: teacher.id, institutionId } }), db.teacherInstitution.create({ data: { teacherId: otherTeacher.id, institutionId } })]);
  assignmentId = (await db.teachingAssignment.create({ data: { teacherId: teacher.id, institutionId, courseId, subjectId: subject.id } })).id;
  otherAssignmentId = (await db.teachingAssignment.create({ data: { teacherId: otherTeacher.id, institutionId, courseId, subjectId: subject.id } })).id;
  const student = await db.student.create({ data: { givenNames: 'Ana', familyNames: `Asistencia ${suffix}` } });
  enrollmentId = (await db.enrollment.create({ data: { studentId: student.id, courseId, academicYearId: year.id } })).id;
  const role = await db.role.create({ data: { code: `A-E2E-${suffix}`, name: 'A E2E' } });
  const scope = await db.accessScope.create({ data: { institutionId, kind: ScopeKind.COURSE_SET, createdById: technical.id, courses: { create: { courseId } } } });
  const assignment = await db.roleAssignment.create({ data: { userId: user.id, roleId: role.id, scopeId: scope.id, grantedById: technical.id } });
  const codes = ['attendance.read', 'attendance.manage', 'enrollment.read', 'student.read'];
  const permissions = await db.permission.findMany({ where: { code: { in: codes } } });
  await db.roleAssignmentPermission.createMany({ data: permissions.map(permission => ({ roleAssignmentId: assignment.id, permissionId: permission.id, delegatedById: technical.id })) });
});
test.afterAll(async () => db.$disconnect());

test('A-25: login, sesión, lote, fecha e historial con aislamiento real', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(login);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar a EduGestor' }).click();
  await expect(page.getByRole('heading', { name: 'Mis asignaciones' })).toBeVisible();
  await page.getByRole('link', { name: 'Asistencia' }).click();
  await expect(page.getByRole('heading', { name: 'Asistencia' })).toBeVisible();
  await page.getByLabel('Fecha de clase').fill('2026-05-20');
  await page.getByRole('button', { name: 'Crear otra sesión' }).click();
  await expect(page.getByText('Sesión creada sin marcas automáticas.')).toBeVisible();
  const session = await db.attendanceSession.findFirstOrThrow({ where: { teachingAssignmentId: assignmentId, classDate: new Date('2026-05-20') }, orderBy: { createdAt: 'desc' } });
  expect(await db.attendanceRecord.count({ where: { attendanceSessionId: session.id } })).toBe(0);
  await expect(page.getByRole('combobox', { name: /Estado de Ana Asistencia/ })).toHaveValue('');
  await page.getByRole('button', { name: 'Marcar presentes sin registrar' }).click();
  await page.getByRole('button', { name: 'Guardar cambios por lote' }).click();
  await expect(page.getByText('Cambios guardados en un solo lote.')).toBeVisible();
  expect(await db.attendanceRecord.count({ where: { attendanceSessionId: session.id, enrollmentId, status: 'PRESENTE' } })).toBe(1);
  await page.getByRole('button', { name: 'Ver historial' }).click();
  await expect(page.getByRole('heading', { name: 'Historial por matrícula' })).toBeVisible();
  await expect(page.getByText(/2026-05-20 · Asistencia/)).toBeVisible();
  await page.getByLabel('Desde').fill('2026-05-20');
  await page.getByLabel('Hasta').fill('2026-05-20');
  await expect(page.getByText(new RegExp(`Sesión ${session.id.slice(0, 8)}`))).toBeVisible();
  const apiBase = process.env.E2E_API_URL ?? 'http://localhost:3000';
  const foreign = await page.request.get(`${apiBase}/api/v1/teaching-assignments/${otherAssignmentId}/attendance-sessions`);
  expect(foreign.status()).toBe(404);
  const wrongCourse = await page.request.get(`${apiBase}/api/v1/institutions/${institutionId}/courses/${randomUUID()}/attendance-sessions`);
  expect(wrongCourse.status()).toBe(404);
});
