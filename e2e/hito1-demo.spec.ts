import { expect, test, type Route } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join } from 'node:path';

let staticServer: Server;
test.beforeAll(async () => {
  const root = join(process.cwd(), 'apps', 'web', 'dist');
  staticServer = createServer(async (request, response) => {
    const requested = request.url === '/' ? '/index.html' : (request.url ?? '/index.html');
    const path = requested.includes('.') ? join(root, requested.split('?')[0]) : join(root, 'index.html');
    try {
      const body = await readFile(path);
      response.writeHead(200, { 'content-type': extname(path) === '.js' ? 'text/javascript' : extname(path) === '.css' ? 'text/css' : 'text/html' });
      response.end(body);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise<void>((resolve) => staticServer.listen(4174, '127.0.0.1', resolve));
});
test.afterAll(async () => { await new Promise<void>((resolve, reject) => staticServer.close((error) => error ? reject(error) : resolve())); });

const ids = {
  institution: '11111111-1111-4111-8111-111111111111', teacher: '22222222-2222-4222-8222-222222222222',
  user: '33333333-3333-4333-8333-333333333333', year: '44444444-4444-4444-8444-444444444444',
  course: '55555555-5555-4555-8555-555555555555', subject: '66666666-6666-4666-8666-666666666666', assignment: '77777777-7777-4777-8777-777777777777',
};

test('recorrido demostrable del Hito 1', async ({ page }) => {
  let account: 'admin' | 'teacher' | null = null; let teacherCreated = false; let yearCreated = false; let courseCreated = false; let subjectCreated = false; let assignmentCreated = false;
  const institution = { id: ids.institution, name: 'Colegio Horizonte Demo', isActive: true, disabledAt: null, rowVersion: 0 };
  const year = { id: ids.year, institutionId: ids.institution, label: '2026', startsOn: '2026-02-01T00:00:00.000Z', endsOn: '2026-11-30T00:00:00.000Z', isCurrent: true, rowVersion: 0 };
  const course = { id: ids.course, institutionId: ids.institution, academicYearId: ids.year, grade: '1.º BTI', section: 'A', shift: 'Mañana', btiYear: null, isActive: true, disabledAt: null, rowVersion: 0, academicYear: year };
  const subject = { id: ids.subject, institutionId: ids.institution, name: 'Programación I', isActive: true, disabledAt: null, rowVersion: 0 };
  const teacher = { id: ids.teacher, userId: ids.user, displayName: 'Ana Docente', isActive: true, disabledAt: null, rowVersion: 0, user: { id: ids.user, login: 'docente.demo', isActive: true }, institutions: [{ id: '88888888-8888-4888-8888-888888888888', institutionId: ids.institution, endedAt: null }] };
  const assignment = { id: ids.assignment, teacherId: ids.teacher, institutionId: ids.institution, courseId: ids.course, subjectId: ids.subject, endedAt: null, rowVersion: 0, teacher, institution, course, subject };
  const session = () => account === 'admin' ? { user: { id: '99999999-9999-4999-8999-999999999999', login: 'admin.demo', accountKind: 'STANDARD', teacher: null }, session: { expiresAt: '2026-09-25T20:00:00.000Z' } } : { user: { id: ids.user, login: 'docente.demo', accountKind: 'STANDARD', teacher: { id: ids.teacher, displayName: 'Ana Docente', isActive: true } }, session: { expiresAt: '2026-09-25T20:00:00.000Z' } };
  const fulfill = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: status === 204 ? '' : JSON.stringify(body) });

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
    if (path.endsWith('/auth/session')) return account ? fulfill(route, session()) : fulfill(route, { error: { code: 'AUTH_REQUIRED', message: 'Autenticación requerida' } }, 401);
    if (path.endsWith('/auth/login')) { const body = request.postDataJSON() as { login: string }; account = body.login === 'docente.demo' ? 'teacher' : 'admin'; return fulfill(route, session()); }
    if (path.endsWith('/auth/csrf')) return fulfill(route, { csrfToken: 'csrf-e2e-demo' });
    if (path.endsWith('/auth/logout')) { account = null; return fulfill(route, {}, 204); }
    if (path.includes('/authorization/check/')) return account === 'admin' ? fulfill(route, { authorized: true }) : fulfill(route, { error: { code: 'AUTHORIZATION_DENIED', message: 'Acceso denegado' } }, 403);
    if (path === '/api/v1/institutions' && method === 'GET') return fulfill(route, { institutions: account === 'admin' ? [institution] : [] });
    if (path === `/api/v1/institutions/${ids.institution}`) return fulfill(route, { institution });
    if (path.endsWith('/teachers') && method === 'GET') return fulfill(route, { teachers: teacherCreated ? [teacher] : [] });
    if (path.endsWith('/teachers') && method === 'POST') { teacherCreated = true; return fulfill(route, { teacher }, 201); }
    if (path.endsWith('/academic-years') && method === 'GET') return fulfill(route, { academicYears: yearCreated ? [year] : [] });
    if (path.endsWith('/academic-years') && method === 'POST') { yearCreated = true; return fulfill(route, { academicYear: year }, 201); }
    if (path === '/api/v1/courses' && method === 'GET') return fulfill(route, { courses: courseCreated ? [course] : [] });
    if (path === '/api/v1/courses' && method === 'POST') { courseCreated = true; return fulfill(route, { course }, 201); }
    if (path === '/api/v1/subjects' && method === 'GET') return fulfill(route, { subjects: subjectCreated ? [subject] : [] });
    if (path === '/api/v1/subjects' && method === 'POST') { subjectCreated = true; return fulfill(route, { subject }, 201); }
    if (path === '/api/v1/teaching-assignments' && method === 'GET') return fulfill(route, { teachingAssignments: assignmentCreated ? [assignment] : [] });
    if (path === '/api/v1/teaching-assignments' && method === 'POST') { assignmentCreated = true; return fulfill(route, { teachingAssignment: assignment }, 201); }
    if (path.endsWith('/me/teaching-assignments')) return fulfill(route, { teachingAssignments: assignmentCreated ? [assignment] : [] });
    if (path.endsWith('/teaching-assignments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/access')) return fulfill(route, { error: { code: 'TEACHING_ASSIGNMENT_ACCESS_DENIED', message: 'Acceso denegado' } }, 403);
    return fulfill(route, { error: { code: 'NOT_FOUND', message: 'Ruta simulada no encontrada' } }, 404);
  });

  await page.goto('/login'); await page.getByLabel('Usuario').fill('admin.demo'); await page.getByLabel('Contraseña').fill('DemoAdmin-2026!'); await page.getByRole('button', { name: 'Ingresar a EduGestor' }).click();
  await expect(page.getByRole('heading', { name: 'Instituciones' })).toBeVisible(); await page.getByRole('link', { name: 'Administrar' }).click();
  await page.getByLabel('Nombre completo').fill('Ana Docente'); await page.getByLabel('Usuario').fill('docente.demo'); await page.getByLabel('Contraseña inicial').fill('DemoDocente-2026!'); await page.getByRole('button', { name: 'Crear docente' }).click(); await expect(page.getByText('Docente, cuenta y vínculo institucional creados correctamente.')).toBeVisible();
  await page.getByRole('link', { name: 'Año y cursos' }).click(); await page.getByLabel('Etiqueta').fill('2026'); await page.getByLabel('Inicio').fill('2026-02-01'); await page.getByLabel('Fin').fill('2026-11-30'); await page.getByText('Establecer como año actual').click(); await page.getByRole('button', { name: 'Crear año lectivo' }).click(); await expect(page.getByText('Año lectivo creado.')).toBeVisible();
  await page.getByLabel('Año lectivo').selectOption(ids.year); await page.getByLabel('Año / grado').fill('1.º BTI'); await page.getByLabel('Sección').fill('A'); await page.getByLabel('Turno').fill('Mañana'); await page.getByRole('button', { name: 'Crear curso' }).click(); await expect(page.getByText('Curso creado.')).toBeVisible();
  await page.getByRole('link', { name: 'Materias' }).click(); await page.getByLabel('Nombre').fill('Programación I'); await page.getByRole('button', { name: 'Crear materia' }).click(); await expect(page.getByText('Materia creada.')).toBeVisible();
  await page.getByRole('link', { name: 'Asignaciones' }).click(); await page.getByLabel('Docente').selectOption(ids.teacher); await page.getByLabel('Curso').selectOption(ids.course); await page.getByLabel('Materia').selectOption(ids.subject); await page.getByRole('button', { name: 'Asignar docente' }).click(); await expect(page.getByText('Asignación docente creada.')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click(); await page.getByLabel('Usuario').fill('docente.demo'); await page.getByLabel('Contraseña').fill('DemoDocente-2026!'); await page.getByRole('button', { name: 'Ingresar a EduGestor' }).click(); await expect(page.getByRole('heading', { name: 'Mis asignaciones' })).toBeVisible(); await expect(page.getByRole('heading', { name: 'Programación I' })).toBeVisible(); await expect(page.getByText('1.º BTI')).toBeVisible();
  const foreignStatus = await page.evaluate(async () => (await fetch('/api/v1/authorization/teaching-assignments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/access')).status); expect(foreignStatus).toBe(403);
});
