import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../../api/client';
import { AttendancePage } from './AttendancePage';

const institutionId = '11111111-1111-4111-8111-111111111111';
const courseId = '22222222-2222-4222-8222-222222222222';
const assignmentId = '33333333-3333-4333-8333-333333333333';
const sessionId = '44444444-4444-4444-8444-444444444444';
const enrollmentId = (index: number) => `55555555-5555-4555-8555-${String(index).padStart(12, '0')}`;
const studentId = (index: number) => `66666666-6666-4666-8666-${String(index).padStart(12, '0')}`;
const roster = Array.from({ length: 40 }, (_, index) => ({ id: enrollmentId(index), student: { id: studentId(index), givenNames: `Alumno ${index}`, familyNames: 'Prueba', isActive: true } }));
const record = { id: '77777777-7777-4777-8777-777777777777', enrollmentId: enrollmentId(0), attendanceSessionId: sessionId, status: 'AUSENTE', isJustified: true, justificationObservation: 'Certificado', observation: 'Observación general', rowVersion: 3, recordedById: '88888888-8888-4888-8888-888888888888', student: roster[0]!.student };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const pathOf = (input: RequestInfo | URL) => new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost').pathname + new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost').search;
const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/teacher/institutions/${institutionId}/courses/${courseId}/assignments/${assignmentId}/attendance`]}><Routes><Route path="/teacher/institutions/:institutionId/courses/:courseId/assignments/:assignmentId/attendance" element={<AttendancePage />} /></Routes></MemoryRouter></QueryClientProvider>);
};
afterEach(() => { vi.unstubAllGlobals(); resetCsrfToken(); });

describe('A-24: Materia → Asistencia', () => {
  it('muestra 40 matrículas, separa sin marcar y guarda solo las marcas explícitas en lote', async () => {
    const writes: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input);
      if (path.endsWith('/auth/csrf')) return json({ csrfToken: 'csrf-attendance' });
      if (path.includes('/authorization/check/')) return json({ authorized: true });
      if (path.endsWith(`/attendance-sessions/${sessionId}`)) return json({ data: { session: { id: sessionId, classDate: '2026-05-20' }, records: [record] } });
      if (path.includes('/courses/') && path.includes('/students')) return json({ data: roster, nextCursor: null });
      if (path.endsWith('/records/batch') && init?.method === 'PUT') { writes.push(JSON.parse(String(init.body))); return json({ data: { records: [], createdCount: 39, updatedCount: 0 } }); }
      if (path.includes('/attendance-sessions?')) return json({ data: [{ id: sessionId, classDate: '2026-05-20' }], nextCursor: null });
      return json({ data: [], nextCursor: null });
    }));
    renderPage(); const user = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Asistencia' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /Sesión 2026-05-20/ }));
    const unmarked = await screen.findByRole('combobox', { name: 'Estado de Alumno 39 Prueba' });
    expect(unmarked).toHaveValue('');
    expect(within(unmarked).getAllByRole('option')).toHaveLength(5);
    expect(within(screen.getByRole('combobox', { name: 'Estado de Alumno 0 Prueba' })).getAllByRole('option')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /borrar sesión|eliminar sesión|borrar marca/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Los registros existentes son los únicos hechos históricos certificados/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Marcar presentes sin registrar' }));
    expect(screen.getByRole('combobox', { name: 'Estado de Alumno 39 Prueba' })).toHaveValue('PRESENTE');
    expect(screen.getByRole('combobox', { name: 'Estado de Alumno 0 Prueba' })).toHaveValue('AUSENTE');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios por lote' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    const payload = writes[0] as { records: { enrollmentId: string; status: string; expectedVersion: number | null }[] };
    expect(payload.records).toHaveLength(39);
    expect(payload.records.some(item => item.enrollmentId === enrollmentId(0))).toBe(false);
    expect(payload.records.every(item => item.status === 'PRESENTE' && item.expectedVersion === null)).toBe(true);
  });

  it('limpia la observación justificativa sin perder la general y recarga un conflicto', async () => {
    let writes = 0;
    let body: any;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input);
      if (path.endsWith('/auth/csrf')) return json({ csrfToken: 'csrf-attendance' });
      if (path.includes('/authorization/check/')) return json({ authorized: true });
      if (path.endsWith(`/attendance-sessions/${sessionId}`)) return json({ data: { session: { id: sessionId, classDate: '2026-05-20' }, records: [record] } });
      if (path.includes('/courses/') && path.includes('/students')) return json({ data: roster, nextCursor: null });
      if (path.endsWith('/records/batch') && init?.method === 'PUT') { writes++; body = JSON.parse(String(init.body)); return json({ error: { code: 'STALE_VERSION', message: 'Versión desactualizada' } }, 409); }
      if (path.includes('/attendance-sessions?')) return json({ data: [{ id: sessionId, classDate: '2026-05-20' }], nextCursor: null });
      return json({ data: [], nextCursor: null });
    }));
    renderPage(); const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Sesión 2026-05-20/ }));
    const row = (await screen.findByRole('combobox', { name: 'Estado de Alumno 0 Prueba' })).closest('tr')!;
    await user.click(within(row).getByRole('checkbox', { name: 'Justificada' }));
    expect(within(row).getByRole('textbox', { name: 'Observación justificativa de Alumno 0' })).toHaveValue('');
    expect(within(row).getByRole('textbox', { name: 'Observación general de Alumno 0' })).toHaveValue('Observación general');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios por lote' }));
    await waitFor(() => expect(writes).toBe(1));
    expect(body.records[0]).toMatchObject({ enrollmentId: enrollmentId(0), status: 'AUSENTE', isJustified: false, justificationObservation: null, observation: 'Observación general', expectedVersion: 3 });
    await user.click(await screen.findByRole('button', { name: 'Recargar y revisar versiones' }));
    expect(await screen.findByText('Datos recargados. Revisa las marcas antes de guardar.')).toBeInTheDocument();
  });
});
