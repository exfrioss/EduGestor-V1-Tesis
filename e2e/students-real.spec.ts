import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { PERMISSION_CATALOG } from '../apps/api/src/modules/authorization/permission-catalog';
import { hashPassword } from '../apps/api/src/security/password';

const requireFromApi = createRequire(resolve(process.cwd(), 'apps/api/package.json'));
const { AccountKind, PrismaClient, ScopeKind } = requireFromApi('@prisma/client') as {
  AccountKind: { TECHNICAL: 'TECHNICAL' }; ScopeKind: { INSTITUTION: 'INSTITUTION'; COURSE_SET: 'COURSE_SET' };
  PrismaClient: new () => import('../apps/api/node_modules/@prisma/client').PrismaClient;
};
const db = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const adminLogin = `stu.e2e.admin.${suffix}`;
const teacherLogin = `stu.e2e.teacher.${suffix}`;
const adminPassword = `Student-Admin-${randomUUID()}`;
const teacherPassword = `Student-Teacher-${randomUUID()}`;
let institutionId: string, sourceCourseId: string, targetCourseId: string, assignmentId: string;
const existingName = `Existente ${suffix}`;

test.beforeAll(async () => {
  for (const permission of PERMISSION_CATALOG) await db.permission.upsert({ where: { code: permission.code }, create: permission, update: { description: permission.description } });
  const [technical, admin, teacherUser] = await Promise.all([
    db.user.create({ data: { login: `stu.e2e.tech.${suffix}`, loginNormalized: `stu.e2e.tech.${suffix}`, passwordHash: await hashPassword(`Technical-${randomUUID()}`), accountKind: AccountKind.TECHNICAL } }),
    db.user.create({ data: { login: adminLogin, loginNormalized: adminLogin, passwordHash: await hashPassword(adminPassword) } }),
    db.user.create({ data: { login: teacherLogin, loginNormalized: teacherLogin, passwordHash: await hashPassword(teacherPassword) } }),
  ]);
  const institution = await db.institution.create({ data: { name: `STU E2E ${suffix}` } });
  institutionId = institution.id;
  const year = await db.academicYear.create({ data: { institutionId, label: `2026-${suffix}`, startsOn: new Date('2026-02-01'), endsOn: new Date('2026-11-30') } });
  const [source, target] = await Promise.all([
    db.course.create({ data: { institutionId, academicYearId: year.id, grade: '1.º', section: suffix, shift: 'Mañana' } }),
    db.course.create({ data: { institutionId, academicYearId: year.id, grade: '2.º', section: suffix, shift: 'Mañana' } }),
  ]);
  sourceCourseId = source.id; targetCourseId = target.id;
  const student = await db.student.create({ data: { givenNames: existingName, familyNames: 'Visible' } });
  await db.enrollment.create({ data: { studentId: student.id, courseId: source.id, academicYearId: year.id } });
  const teacher = await db.teacher.create({ data: { userId: teacherUser.id, displayName: `Docente ${suffix}` } });
  await db.teacherInstitution.create({ data: { teacherId: teacher.id, institutionId } });
  const subject = await db.subject.create({ data: { institutionId, name: `Materia ${suffix}`, nameNormalized: `materia-${suffix}` } });
  assignmentId = (await db.teachingAssignment.create({ data: { teacherId: teacher.id, institutionId, courseId: target.id, subjectId: subject.id } })).id;
  const role = await db.role.create({ data: { code: `STU-E2E-${suffix}`, name: 'STU E2E' } });
  const adminScope = await db.accessScope.create({ data: { institutionId, kind: ScopeKind.INSTITUTION, createdById: technical.id } });
  const teacherScope = await db.accessScope.create({ data: { institutionId, kind: ScopeKind.COURSE_SET, createdById: technical.id, courses: { create: { courseId: target.id } } } });
  const adminAssignment = await db.roleAssignment.create({ data: { userId: admin.id, roleId: role.id, scopeId: adminScope.id, grantedById: technical.id } });
  const teacherAssignment = await db.roleAssignment.create({ data: { userId: teacherUser.id, roleId: role.id, scopeId: teacherScope.id, grantedById: technical.id } });
  for (const [assignment, codes] of [
    [adminAssignment, ['institution.read','course.read','student.read','student.manage','enrollment.read','enrollment.manage']],
    [teacherAssignment, ['course.read','student.read','enrollment.read']],
  ] as const) {
    const permissions = await db.permission.findMany({ where: { code: { in: [...codes] } } });
    await db.roleAssignmentPermission.createMany({ data: permissions.map(permission => ({ roleAssignmentId: assignment.id, permissionId: permission.id, delegatedById: technical.id })) });
  }
});
test.afterAll(async () => db.$disconnect());

test('STU-23/24: UI real registra, reutiliza matrícula y abre perfil docente contextual', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(adminLogin);
  await page.getByLabel('Contraseña').fill(adminPassword);
  await page.getByRole('button', { name: 'Ingresar a EduGestor' }).click();
  await expect(page.getByRole('heading', { name: 'Instituciones' })).toBeVisible();
  await page.goto(`/admin/institutions/${institutionId}/courses/${targetCourseId}/students`);
  await expect(page.getByRole('heading', { name: 'Estudiantes' })).toBeVisible();
  await page.getByPlaceholder('Buscar estudiante visible').fill(existingName);
  await expect(page.getByText(`Visible, ${existingName}`)).toBeVisible();
  await page.getByRole('button', { name: 'Matricular', exact: true }).click();
  await expect(page.getByText('Matrícula creada.')).toBeVisible();
  await page.getByLabel('Nombres').fill('Nueva');
  await page.getByLabel('Apellidos').fill(`SinCédula ${suffix}`);
  await page.getByRole('button', { name: 'Registrar y matricular' }).click();
  await expect(page.getByText('Estudiante registrado y matriculado.')).toBeVisible();
  await expect(page.getByText(`SinCédula ${suffix}, Nueva`)).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.getByLabel('Usuario').fill(teacherLogin);
  await page.getByLabel('Contraseña').fill(teacherPassword);
  await page.getByRole('button', { name: 'Ingresar a EduGestor' }).click();
  await expect(page.getByRole('heading', { name: 'Mis asignaciones' })).toBeVisible();
  await page.getByRole('link', { name: 'Perfiles de Alumnos' }).click();
  await expect(page).toHaveURL(new RegExp(`/assignments/${assignmentId}/students`));
  await expect(page.getByText(`Visible, ${existingName}`)).toBeVisible();
  await page.getByRole('button', { name: 'Ver perfil' }).first().click();
  await expect(page.getByText(/Matrículas visibles:/)).toBeVisible();
  await expect(page.getByText('Cédula: No informada')).toBeVisible();
});
