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
const login = `b.e2e.teacher.${suffix}`;
const password = `B-${randomUUID()}`;
let institutionId: string, courseId: string, assignmentId: string;

test.beforeAll(async () => {
  for (const item of PERMISSION_CATALOG) await db.permission.upsert({ where: { code: item.code }, create: item, update: { description: item.description } });
  const [technical, user] = await Promise.all([
    db.user.create({ data: { login: `b.e2e.tech.${suffix}`, loginNormalized: `b.e2e.tech.${suffix}`, passwordHash: await hashPassword(`T-${randomUUID()}`), accountKind: AccountKind.TECHNICAL } }),
    db.user.create({ data: { login, loginNormalized: login, passwordHash: await hashPassword(password) } }),
  ]);
  const institution = await db.institution.create({ data: { name: `B E2E ${suffix}` } }); institutionId = institution.id;
  const year = await db.academicYear.create({ data: { institutionId, label: `2026-${suffix}`, startsOn: new Date('2026-02-01'), endsOn: new Date('2026-11-30') } });
  const course = await db.course.create({ data: { institutionId, academicYearId: year.id, grade: '1.º', section: suffix, shift: 'Mañana' } }); courseId = course.id;
  const subject = await db.subject.create({ data: { institutionId, name: `Materia ${suffix}`, nameNormalized: `materia-b-${suffix}` } });
  const teacher = await db.teacher.create({ data: { userId: user.id, displayName: `Docente ${suffix}` } });
  await db.teacherInstitution.create({ data: { teacherId: teacher.id, institutionId } });
  assignmentId = (await db.teachingAssignment.create({ data: { teacherId: teacher.id, institutionId, courseId, subjectId: subject.id } })).id;
  const student = await db.student.create({ data: { givenNames: 'Ana', familyNames: `Proceso ${suffix}` } });
  await db.enrollment.create({ data: { studentId: student.id, courseId, academicYearId: year.id } });
  const role = await db.role.create({ data: { code: `B-E2E-${suffix}`, name: 'B E2E' } });
  const scope = await db.accessScope.create({ data: { institutionId, kind: ScopeKind.COURSE_SET, createdById: technical.id, courses: { create: { courseId } } } });
  const assignment = await db.roleAssignment.create({ data: { userId: user.id, roleId: role.id, scopeId: scope.id, grantedById: technical.id } });
  const codes = ['activity-bank.read', 'activity-bank.manage', 'task.read', 'task.manage', 'assessment.read', 'assessment.manage', 'assessment-result.read', 'assessment-result.manage', 'enrollment.read', 'student.read'];
  const permissions = await db.permission.findMany({ where: { code: { in: codes } } });
  await db.roleAssignmentPermission.createMany({ data: permissions.map(permission => ({ roleAssignmentId: assignment.id, permissionId: permission.id, delegatedById: technical.id })) });
});
test.afterAll(async () => db.$disconnect());

test('B-23/24: UI real crea actividades, distingue cero y muestra Proceso sin nota', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(login);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar a EduGestor' }).click();
  await expect(page.getByRole('heading', { name: 'Mis asignaciones' })).toBeVisible();
  await page.getByRole('link', { name: 'Tareas y Evaluaciones' }).click();
  await expect(page.getByRole('heading', { name: 'Tareas y Evaluaciones' })).toBeVisible();
  await page.getByRole('heading', { name: 'Crear tarea' }).locator('..').getByLabel('Título').fill(`Ordinaria ${suffix}`);
  const form = page.getByRole('heading', { name: 'Crear tarea' }).locator('..');
  await form.getByLabel('Descripción').fill('Trabajo de aula');
  await form.getByLabel('Máximo').fill('20');
  await form.getByRole('button', { name: 'Crear tarea' }).click();
  await expect(page.getByText(`Ordinaria ${suffix}`)).toBeVisible();
  await page.getByRole('link', { name: 'Ver Proceso' }).click();
  await expect(page.getByRole('heading', { name: 'Proceso', exact: true })).toBeVisible();
  await expect(page.getByText('Proceso parcial')).toBeVisible();
  await expect(page.getByText('Hay resultados pendientes')).toBeVisible();
  await page.getByRole('link', { name: 'Tareas y Evaluaciones' }).click();
  await page.getByRole('button', { name: 'Resultados' }).first().click();
  await page.getByLabel('Puntos de Ana Proceso').fill('0');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Evaluado: 0')).toBeVisible();
  await page.getByRole('link', { name: 'Ver Proceso' }).click();
  await expect(page.getByText('Sin escala válida')).toBeVisible();
  await expect(page.getByText('Obtenido 0')).toBeVisible();
  await expect(page.getByText('—')).toBeVisible();
  await page.getByRole('link', { name: 'Tareas y Evaluaciones' }).click();
  const bankForm = page.getByRole('heading', { name: 'Guardar plantilla' }).locator('..');
  await bankForm.getByLabel('Título').fill(`Banco ${suffix}`);
  await bankForm.getByLabel('Descripción').fill('Contenido de banco');
  await bankForm.getByLabel('Máximo sugerido').fill('2');
  await bankForm.getByRole('button', { name: 'Guardar en banco' }).click();
  await expect(page.getByText(`Banco ${suffix}`)).toBeVisible();
  await page.getByText(`Banco ${suffix}`).locator('..').locator('..').getByRole('button', { name: 'Reutilizar' }).click();
  const copyForm = page.getByRole('heading', { name: 'Revisar copia' }).locator('xpath=ancestor::section').locator('form');
  await copyForm.getByLabel('Máximo de la copia').fill('3');
  await copyForm.getByRole('button', { name: 'Crear copia' }).click();
  await expect(page.getByText('Copia independiente creada en la asignación de destino.')).toBeVisible();
  expect(await db.task.count({ where: { teachingAssignmentId: assignmentId, sourceBankItemId: { not: null }, maxPoints: '3' } })).toBe(1);
  expect(await db.assessment.count({ where: { taskId: { not: null }, teachingAssignmentId: assignmentId } })).toBe(1);
  expect(await db.assessmentResult.count()).toBeGreaterThan(0);
  expect(courseId).toBeTruthy(); expect(institutionId).toBeTruthy();
});
