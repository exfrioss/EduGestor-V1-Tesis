import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { PERMISSION_CATALOG, type PermissionCode } from '../apps/api/src/modules/authorization/permission-catalog';
import { hashPassword } from '../apps/api/src/security/password';

const requireFromApi = createRequire(resolve(process.cwd(), 'apps/api/package.json'));
const { AccountKind, PrismaClient, ScopeKind } = requireFromApi('@prisma/client') as {
  AccountKind: { TECHNICAL: 'TECHNICAL' };
  ScopeKind: { INSTITUTION: 'INSTITUTION' };
  PrismaClient: new () => import('../apps/api/node_modules/@prisma/client').PrismaClient;
};
const client = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const login = `curriculum.e2e.${suffix}`;
const password = `Curriculum-E2E-${randomUUID()}`;
const teacherLogin = `curriculum.e2e.teacher.${suffix}`;
const teacherPassword = `Curriculum-Teacher-E2E-${randomUUID()}`;
let institutionId: string;
let foreignInstitutionId: string;
let subjectId: string;
let foreignSubjectId: string;
let courseId: string;

const grant = async (
  technicalId: string,
  userId: string,
  roleId: string,
  scopeId: string,
  permissions: PermissionCode[],
) => {
  const assignment = await client.roleAssignment.create({
    data: { userId, roleId, scopeId, grantedById: technicalId },
  });
  const records = await client.permission.findMany({ where: { code: { in: permissions } } });
  await client.roleAssignmentPermission.createMany({
    data: records.map(({ id }) => ({
      roleAssignmentId: assignment.id,
      permissionId: id,
      delegatedById: technicalId,
    })),
  });
};

test.beforeAll(async () => {
  for (const permission of PERMISSION_CATALOG) {
    await client.permission.upsert({
      where: { code: permission.code },
      create: permission,
      update: { description: permission.description },
    });
  }
  const [technical, administrator, teacherUser] = await Promise.all([
    client.user.create({
      data: {
        login: `curriculum.e2e.technical.${suffix}`,
        loginNormalized: `curriculum.e2e.technical.${suffix}`,
        passwordHash: await hashPassword(`Technical-${randomUUID()}`),
        accountKind: AccountKind.TECHNICAL,
      },
    }),
    client.user.create({
      data: { login, loginNormalized: login, passwordHash: await hashPassword(password) },
    }),
    client.user.create({
      data: { login: teacherLogin, loginNormalized: teacherLogin, passwordHash: await hashPassword(teacherPassword) },
    }),
  ]);
  const [institution, foreignInstitution] = await Promise.all([
    client.institution.create({ data: { name: `Institución curricular E2E ${suffix}` } }),
    client.institution.create({ data: { name: `Institución ajena E2E ${suffix}` } }),
  ]);
  institutionId = institution.id;
  foreignInstitutionId = foreignInstitution.id;
  const [subject, foreignSubject] = await Promise.all([
    client.subject.create({ data: { institutionId, name: `Diseño E2E ${suffix}`, nameNormalized: `diseno-e2e-${suffix}` } }),
    client.subject.create({ data: { institutionId: foreignInstitutionId, name: `Materia ajena ${suffix}`, nameNormalized: `materia-ajena-${suffix}` } }),
  ]);
  subjectId = subject.id;
  foreignSubjectId = foreignSubject.id;
  const year = await client.academicYear.create({ data: { institutionId, label: `2026-${suffix}`, startsOn: new Date('2026-02-01'), endsOn: new Date('2026-11-30') } });
  const course = await client.course.create({ data: { institutionId, academicYearId: year.id, grade: '3.º BTI', section: suffix, shift: 'Mañana', btiYear: 3 } });
  courseId = course.id;
  const teacher = await client.teacher.create({ data: { userId: teacherUser.id, displayName: `Docente curricular ${suffix}` } });
  await client.teacherInstitution.create({ data: { teacherId: teacher.id, institutionId } });
  await client.teachingAssignment.create({ data: { teacherId: teacher.id, institutionId, courseId, subjectId } });
  const plan = await client.planType.create({ data: { code: `E2E-${suffix}`, name: 'Plan E2E' } });
  await client.curriculumDiscipline.createMany({
    data: [
      { planTypeId: plan.id, code: `E2E-A-${suffix}`, officialName: 'Disciplina E2E inicial' },
      { planTypeId: plan.id, code: `E2E-B-${suffix}`, officialName: 'Disciplina E2E sustituta' },
    ],
  });
  const role = await client.role.create({ data: { code: `CURRICULUM-E2E-${suffix}`, name: 'Administrador curricular E2E' } });
  const [scope, teacherScope] = await Promise.all([
    client.accessScope.create({ data: { institutionId, kind: ScopeKind.INSTITUTION, createdById: technical.id } }),
    client.accessScope.create({ data: { institutionId, kind: ScopeKind.COURSE_SET, createdById: technical.id, courses: { create: { courseId } } } }),
  ]);
  await grant(technical.id, administrator.id, role.id, scope.id, [
    'institution.read',
    'subject.read',
    'subject.manage',
    'curriculum-catalog.read',
    'subject-curriculum-mapping.read',
    'subject-curriculum-mapping.manage',
  ]);
  await grant(technical.id, teacherUser.id, role.id, teacherScope.id, [
    'curriculum-catalog.read',
    'subject-curriculum-mapping.read',
  ]);
});

test.afterAll(async () => client.$disconnect());

test('asocia, sustituye y retira una referencia usando React, Express y PostgreSQL reales', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(login);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar a EduGestor' }).click();
  await expect(page.getByRole('heading', { name: 'Instituciones' })).toBeVisible();
  await page.goto(`/admin/institutions/${institutionId}/subjects`);
  await expect(page.getByRole('heading', { name: `Diseño E2E ${suffix}` })).toBeVisible();
  await expect(page.getByText('Sin referencia curricular')).toBeVisible();

  const reference = page.getByRole('region', { name: `Referencia curricular de Diseño E2E ${suffix}` });
  await reference.getByLabel('Año BTI').selectOption('3');
  await reference.getByLabel('Disciplina curricular').last().selectOption({ label: 'Disciplina E2E inicial' });
  await reference.getByRole('button', { name: 'Añadir referencia' }).click();
  await expect(reference.getByText('3.º BTI · Disciplina E2E inicial')).toBeVisible();
  await expect(reference.getByText('Disponibilidad de malla aún no consultable')).toBeVisible();

  await reference.getByText('Sustituir').click();
  const replacement = reference.locator('details[open]');
  await replacement.getByLabel('Disciplina curricular').selectOption({ label: 'Disciplina E2E sustituta' });
  await replacement.getByRole('button', { name: 'Confirmar sustitución' }).click();
  await expect(reference.getByText('3.º BTI · Disciplina E2E sustituta')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await reference.getByRole('button', { name: 'Retirar' }).click();
  await expect(reference.getByText('Sin referencia curricular')).toBeVisible();

  await reference.getByLabel('Año BTI').selectOption('3');
  await reference.getByLabel('Disciplina curricular').last().selectOption({ label: 'Disciplina E2E sustituta' });
  await reference.getByRole('button', { name: 'Añadir referencia' }).click();
  await expect(reference.getByText('3.º BTI · Disciplina E2E sustituta')).toBeVisible();

  const foreignStatus = await page.evaluate(async ({ institution, subject }) => {
    const response = await fetch(`http://localhost:3000/api/v1/institutions/${institution}/subjects/${subject}/curriculum-mappings`, { credentials: 'include' });
    return response.status;
  }, { institution: foreignInstitutionId, subject: foreignSubjectId });
  expect(foreignStatus).toBe(404);

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.getByLabel('Usuario').fill(teacherLogin);
  await page.getByLabel('Contraseña').fill(teacherPassword);
  await page.getByRole('button', { name: 'Ingresar a EduGestor' }).click();
  await expect(page.getByRole('heading', { name: 'Mis asignaciones' })).toBeVisible();
  const teacherRead = await page.evaluate(async ({ institution, subject, course }) => {
    const response = await fetch(`http://localhost:3000/api/v1/institutions/${institution}/subjects/${subject}/curriculum-mappings?courseId=${course}`, { credentials: 'include' });
    const body = await response.json();
    return { status: response.status, count: Array.isArray(body.data) ? body.data.length : -1 };
  }, { institution: institutionId, subject: subjectId, course: courseId });
  expect(teacherRead).toEqual({ status: 200, count: 1 });
});
