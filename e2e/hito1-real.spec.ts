import { expect, test } from '@playwright/test';
import { HITO1_DEMO_DATA, HITO1_DEMO_IDS } from '../apps/api/src/commands/hito1-demo.constants';

const requiredEnvironment = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} es obligatorio para el E2E real`);
  }
  return value;
};

test('Hito 1 completo contra API y PostgreSQL reales', async ({ page }) => {
  const adminLogin = requiredEnvironment('HITO1_DEMO_ADMIN_LOGIN');
  const adminPassword = requiredEnvironment('HITO1_DEMO_ADMIN_PASSWORD');
  const teacherLogin = requiredEnvironment('HITO1_DEMO_TEACHER_ONE_LOGIN');
  const teacherPassword = requiredEnvironment('HITO1_DEMO_TEACHER_ONE_PASSWORD');

  await page.goto('/login');
  await expect(page.getByLabel('Usuario')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Contraseña')).toBeFocused();
  await page.getByLabel('Usuario').fill(adminLogin);
  await page.getByLabel('Contraseña').fill(adminPassword);
  await page.getByRole('button', { name: 'Ingresar a EduGestor' }).click();

  await expect(page.getByRole('heading', { name: 'Instituciones' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Instituciones' })).toBeFocused();
  await expect(page.getByText(HITO1_DEMO_DATA.institutionName)).toBeVisible();
  await page.getByRole('link', { name: 'Administrar' }).click();

  await expect(page.getByRole('heading', { name: 'Docentes y acceso' })).toBeVisible();
  await expect(page.getByText(HITO1_DEMO_DATA.teacherOneName)).toBeVisible();
  await expect(page.getByText(HITO1_DEMO_DATA.teacherTwoName)).toBeVisible();

  await page.getByRole('link', { name: 'Año y cursos' }).click();
  await expect(page.getByRole('heading', { name: 'Año lectivo y cursos' })).toBeVisible();
  await expect(page.getByText(HITO1_DEMO_DATA.academicYearLabel, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(`${HITO1_DEMO_DATA.grade} · Sección ${HITO1_DEMO_DATA.section}`)).toBeVisible();
  await expect(page.getByText(`Turno ${HITO1_DEMO_DATA.shift}`)).toBeVisible();

  await page.getByRole('link', { name: 'Materias' }).click();
  await expect(page.getByRole('heading', { name: 'Materias' })).toBeVisible();
  await expect(page.getByRole('heading', { name: HITO1_DEMO_DATA.subjectName })).toBeVisible();

  await page.getByRole('link', { name: 'Asignaciones' }).click();
  await expect(page.getByRole('heading', { name: 'Asignaciones docentes' })).toBeVisible();
  await expect(page.getByRole('cell', { name: HITO1_DEMO_DATA.teacherOneName }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: HITO1_DEMO_DATA.teacherTwoName }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: HITO1_DEMO_DATA.subjectName }).first()).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();
  await page.getByLabel('Usuario').fill(teacherLogin);
  await page.getByLabel('Contraseña').fill(teacherPassword);
  await page.getByRole('button', { name: 'Ingresar a EduGestor' }).click();

  await expect(page.getByRole('heading', { name: 'Mis asignaciones' })).toBeVisible();
  await expect(page.getByRole('heading', { name: HITO1_DEMO_DATA.subjectName })).toHaveCount(1);
  await expect(page.getByText(HITO1_DEMO_DATA.institutionName).first()).toBeVisible();
  await expect(page.getByText(HITO1_DEMO_DATA.grade).first()).toBeVisible();
  await expect(page.getByText(HITO1_DEMO_DATA.section, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(HITO1_DEMO_DATA.shift).first()).toBeVisible();

  const access = await page.evaluate(
    async ({ ownId, foreignId }) => {
      const own = await fetch(`http://localhost:3000/api/v1/authorization/teaching-assignments/${ownId}/access`, { credentials: 'include' });
      const foreign = await fetch(`http://localhost:3000/api/v1/authorization/teaching-assignments/${foreignId}/access`, { credentials: 'include' });
      return { own: own.status, foreign: foreign.status };
    },
    { ownId: HITO1_DEMO_IDS.teacherOneAssignment, foreignId: HITO1_DEMO_IDS.teacherTwoAssignment },
  );
  expect(access).toEqual({ own: 200, foreign: 403 });

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();
});
