import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, friendlyError, resetCsrfToken } from './api/client';
import { App } from './App';

const institutionId = '11111111-1111-4111-8111-111111111111';
const session = (teacher = false, technical = false) => ({ user: { id: '22222222-2222-4222-8222-222222222222', login: teacher ? 'docente.demo' : 'admin.demo', accountKind: technical ? 'TECHNICAL' : 'STANDARD', teacher: teacher ? { id: '33333333-3333-4333-8333-333333333333', displayName: 'Ana Docente', isActive: true } : null }, session: { expiresAt: '2026-09-25T12:00:00.000Z' } });
const institution = { id: institutionId, name: 'Colegio Demo', isActive: true, disabledAt: null, rowVersion: 0 };
const json = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const pathOf = (input: RequestInfo | URL) => new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost').pathname + new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost').search;

afterEach(() => { vi.unstubAllGlobals(); resetCsrfToken(); window.history.replaceState({}, '', '/'); });

describe('frontend Hito 1', () => {
  it('protege una ruta privada y redirige a login sin sesión', async () => {
    window.history.replaceState({}, '', '/admin/institutions');
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'AUTH_REQUIRED', message: 'Acceso denegado' } }, 401)));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Usuario')).toHaveFocus());
  });

  it('inicia sesión, incluye credenciales y redirige al área administrativa', async () => {
    window.history.replaceState({}, '', '/login'); const calls: Array<{ path: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => { const path = pathOf(input); calls.push({ path, init }); if (path.endsWith('/auth/session')) return json({}, 401); if (path.endsWith('/auth/login')) return json(session()); if (path === '/api/v1/institutions') return json({ institutions: [institution] }); return json({ authorized: true }); }));
    render(<App />); const user = userEvent.setup(); await screen.findByRole('heading', { name: 'Inicia sesión' }); await user.type(screen.getByLabelText('Usuario'), 'admin.demo'); await user.type(screen.getByLabelText('Contraseña'), 'DemoAdmin-2026!'); await user.click(screen.getByRole('button', { name: 'Ingresar a EduGestor' }));
    expect(await screen.findByRole('heading', { name: 'Instituciones' })).toBeInTheDocument();
    const loginCall = calls.find((call) => call.path.endsWith('/auth/login')); expect(loginCall?.init?.credentials).toBe('include'); expect(String(loginCall?.init?.body)).not.toContain('token');
  });

  it('muestra un error uniforme ante credenciales incorrectas', async () => {
    window.history.replaceState({}, '', '/login');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => pathOf(input).endsWith('/auth/session') ? json({}, 401) : json({ error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas', requestId: 'req-demo' } }, 401)));
    render(<App />); const user = userEvent.setup(); await screen.findByRole('heading', { name: 'Inicia sesión' }); await user.type(screen.getByLabelText('Usuario'), 'nadie'); await user.type(screen.getByLabelText('Contraseña'), 'incorrecta'); await user.click(screen.getByRole('button', { name: 'Ingresar a EduGestor' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('sesión no es válida');
  });

  it('restaura la sesión y aplica controles administrativos según permiso', async () => {
    window.history.replaceState({}, '', '/admin/institutions');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => { const path = pathOf(input); if (path.endsWith('/auth/session')) return json(session()); if (path === '/api/v1/institutions') return json({ institutions: [institution] }); if (path.includes('/authorization/check/')) return json({ error: { code: 'AUTHORIZATION_DENIED', message: 'Acceso denegado' } }, 403); return json({}); }));
    render(<App />); expect(await screen.findByText('Colegio Demo')).toBeInTheDocument(); await waitFor(() => expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()); expect(screen.getByText('admin.demo')).toBeInTheDocument();
  });

  it('presenta formularios básicos del contexto académico', async () => {
    window.history.replaceState({}, '', `/admin/institutions/${institutionId}/academic`);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => { const path = pathOf(input); if (path.endsWith('/auth/session')) return json(session()); if (path === '/api/v1/institutions') return json({ institutions: [institution] }); if (path === `/api/v1/institutions/${institutionId}`) return json({ institution }); if (path.endsWith('/academic-years')) return json({ academicYears: [] }); if (path.startsWith('/api/v1/courses')) return json({ courses: [] }); if (path.includes('/authorization/check/')) return json({ authorized: true }); return json({}); }));
    render(<App />); expect(await screen.findByRole('heading', { name: 'Año lectivo y cursos' })).toBeInTheDocument(); expect(await screen.findByLabelText('Etiqueta')).toBeInTheDocument(); expect(screen.getByLabelText('Año / grado')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Crear curso' })).toBeEnabled();
  });

  it('usa CSRF en una creación mutable y nunca persiste tokens en Web Storage', async () => {
    window.history.replaceState({}, '', '/admin/institutions'); let mutationHeaders: HeadersInit | undefined;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => { const path = pathOf(input); if (path.endsWith('/auth/session')) return json(session(false, true)); if (path.endsWith('/auth/csrf')) return json({ csrfToken: 'csrf-demo' }); if (path === '/api/v1/institutions' && init?.method === 'POST') { mutationHeaders = init.headers; return json({ institution }, 201); } if (path === '/api/v1/institutions') return json({ institutions: [] }); return json({}); }));
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem'); render(<App />); const user = userEvent.setup(); await user.type(await screen.findByLabelText('Nombre'), 'Colegio Demo'); await user.type(screen.getByLabelText('Motivo técnico'), 'Preparación de demo'); await user.click(screen.getByRole('button', { name: 'Crear institución' }));
    await screen.findByText('Institución creada.'); expect(mutationHeaders).toMatchObject({ 'x-csrf-token': 'csrf-demo' }); expect(storageSpy).not.toHaveBeenCalled(); storageSpy.mockRestore();
  });

  it('normaliza mensajes para 403, 409 y 422', () => {
    expect(friendlyError(new ApiError(403, 'DENIED', 'x'))).toContain('No tienes permisos'); expect(friendlyError(new ApiError(409, 'CONFLICT', 'x'))).toContain('conflicto'); expect(friendlyError(new ApiError(422, 'INVALID', 'x'))).toContain('Revisa los datos');
  });

  it('muestra estado vacío al docente sin exponer controles administrativos', async () => {
    window.history.replaceState({}, '', '/admin/institutions');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => { const path = pathOf(input); if (path.endsWith('/auth/session')) return json(session(true)); if (path === '/api/v1/institutions') return json({ institutions: [] }); if (path.endsWith('/me/teaching-assignments')) return json({ teachingAssignments: [] }); return json({}); }));
    render(<App />); expect(await screen.findByText('No tienes asignaciones vigentes')).toBeInTheDocument(); expect(screen.queryByRole('link', { name: 'Administración' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /crear|editar|desactivar/i })).not.toBeInTheDocument();
  });

  it('muestra una materia sin referencia como válida y no inventa disponibilidad curricular', async () => {
    window.history.replaceState({}, '', `/admin/institutions/${institutionId}/subjects`);
    const subject = { id: '44444444-4444-4444-8444-444444444444', institutionId, name: 'Programación', isActive: true, disabledAt: null, rowVersion: 1 };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = pathOf(input);
      if (path.endsWith('/auth/session')) return json(session());
      if (path === '/api/v1/institutions') return json({ institutions: [institution] });
      if (path === `/api/v1/institutions/${institutionId}`) return json({ institution });
      if (path === `/api/v1/subjects?institutionId=${institutionId}`) return json({ subjects: [subject] });
      if (path.includes('/authorization/check/')) return json({ authorized: true });
      if (path.includes('/curriculum-mappings')) return json({ data: [], nextCursor: null });
      if (path.startsWith('/api/v1/curriculum/disciplines')) return json({ data: [], nextCursor: null });
      return json({});
    }));
    render(<App />);
    expect(await screen.findByText('Sin referencia curricular')).toBeInTheDocument();
    expect(screen.getByText('La materia puede utilizarse normalmente sin correspondencia.')).toBeInTheDocument();
    expect(screen.queryByText(/malla validada/i)).not.toBeInTheDocument();
  });

  it('presenta referencia vigente, área no validada y acciones curriculares autorizadas', async () => {
    window.history.replaceState({}, '', `/admin/institutions/${institutionId}/subjects`);
    const subject = { id: '55555555-5555-4555-8555-555555555555', institutionId, name: 'Diseño Gráfico', isActive: true, disabledAt: null, rowVersion: 1 };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = pathOf(input);
      if (path.endsWith('/auth/session')) return json(session());
      if (path === '/api/v1/institutions') return json({ institutions: [institution] });
      if (path === `/api/v1/institutions/${institutionId}`) return json({ institution });
      if (path === `/api/v1/subjects?institutionId=${institutionId}`) return json({ subjects: [subject] });
      if (path.includes('/authorization/check/')) return json({ authorized: true });
      if (path.includes('/curriculum-mappings')) return json({ data: [{ id: '66666666-6666-4666-8666-666666666666', subjectId: subject.id, btiYear: 3, curriculumDisciplineId: '77777777-7777-4777-8777-777777777777', discipline: { officialName: 'Diseño Gráfico', planType: { id: '88888888-8888-4888-8888-888888888888', name: 'Plan Optativo' }, academicArea: null }, retiredAt: null, rowVersion: 1 }], nextCursor: null });
      if (path.startsWith('/api/v1/curriculum/disciplines')) return json({ data: [], nextCursor: null });
      return json({});
    }));
    render(<App />);
    expect(await screen.findByText('3.º BTI · Diseño Gráfico')).toBeInTheDocument();
    expect(screen.getByText(/Área académica aún no validada/)).toBeInTheDocument();
    expect(screen.getByText('Disponibilidad de malla aún no consultable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retirar' })).toBeInTheDocument();
    expect(screen.getByText('Sustituir')).toBeInTheDocument();
  });
});

describe('Hito 2A — estudiantes', () => {
  const courseId = '99999999-9999-4999-8999-999999999999';
  const studentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const course = { id: courseId, institutionId, academicYearId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', grade: '1.º', section: 'A', shift: 'Mañana', academicYear: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', label: '2026' } };
  const student = { id: studentId, givenNames: 'Ana', familyNames: 'López', nationalId: null, isActive: false, rowVersion: 1 };
  const enrollment = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', studentId, courseId, academicYearId: course.academicYearId, createdAt: '2026-02-01T00:00:00Z', student };

  it('STU-23: muestra nómina, búsqueda, cédula opcional, inactividad y conflicto opaco', async () => {
    window.history.replaceState({}, '', `/admin/institutions/${institutionId}/courses/${courseId}/students`);
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input); calls.push(path);
      if (path.endsWith('/auth/session')) return json(session());
      if (path.endsWith('/auth/csrf')) return json({ csrfToken: 'csrf-stu' });
      if (path === '/api/v1/institutions') return json({ institutions: [institution] });
      if (path === `/api/v1/institutions/${institutionId}`) return json({ institution });
      if (path === `/api/v1/courses/${courseId}`) return json({ course });
      if (path.includes('/authorization/check/')) return json({ authorized: true });
      if (path.includes('/courses/') && path.endsWith('/students') && init?.method === 'POST') return json({ error: { code: 'CONFLICT', message: 'Conflicto', requestId: 'stu-test' } }, 409);
      if (path.includes('/courses/') && path.includes('/students')) return json({ data: [enrollment], nextCursor: null });
      if (path.includes('/students?q=')) return json({ data: [], nextCursor: null });
      return json({ data: [], nextCursor: null });
    }));
    render(<App />);
    const user = userEvent.setup();
    expect(await screen.findByText('López, Ana')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Buscar estudiante visible'), 'inexistente');
    expect(await screen.findByText('No hay coincidencias visibles.')).toBeInTheDocument();
    expect(calls.some(path => path.includes('q=inexistente'))).toBe(true);
    await user.type(screen.getByLabelText('Nombres'), 'Nueva');
    await user.type(screen.getByLabelText('Apellidos'), 'Persona');
    await user.click(screen.getByRole('button', { name: 'Registrar y matricular' }));
    expect(await screen.findByText(/existe un conflicto con los datos registrados/i)).toBeInTheDocument();
  });

  it('STU-24: perfiles desde materia presentan solo identidad y matrícula contextual', async () => {
    const assignmentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    window.history.replaceState({}, '', `/teacher/institutions/${institutionId}/courses/${courseId}/assignments/${assignmentId}/students`);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = pathOf(input);
      if (path.endsWith('/auth/session')) return json(session(true));
      if (path === '/api/v1/institutions') return json({ institutions: [] });
      if (path === `/api/v1/courses/${courseId}`) return json({ course });
      if (path.includes('/courses/') && path.endsWith('/students')) return json({ data: [enrollment], nextCursor: null });
      if (path.includes(`/students/${studentId}`)) return json({ data: { student, enrollments: [enrollment] } });
      return json({});
    }));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Perfiles de Alumnos' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ver perfil' }));
    expect(await screen.findByText('Cédula: No informada')).toBeInTheDocument();
    expect(screen.getByText(/Matrículas visibles:/)).toBeInTheDocument();
    expect(screen.queryByText(/calificaciones|asistencia|conducta|tareas/i)).not.toBeInTheDocument();
  });
});
