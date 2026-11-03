import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { MaxPointsEditor } from './GradingControls';
import { GradingScalePanel } from './GradingScalePanel';

const mutation = vi.fn();
vi.mock('../../api/client', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../api/client')>(),
  apiMutation: (...args: unknown[]) => mutation(...args),
  apiRequest: async (path: string) => path.includes('/grading-scales?')
    ? { data: [{ id: 'scale', name: 'Escala', version: 1, minimumGrade: '1', maximumGrade: '5', lockedAt: null }], nextCursor: null }
    : path.endsWith('/grading-scale') ? { data: null }
      : { teachingAssignments: [{ id: 'assignment', rowVersion: 1 }] },
}));
vi.mock('../../auth/PermissionGate', () => ({ PermissionGate: ({ children }: { children: React.ReactNode }) => children }));

describe('Hito 2B-2: cambio de máximo en la UI', () => {
  beforeEach(() => mutation.mockReset());
  it('muestra impacto y advertencia, permite cancelar y confirma con el token de preview', async () => {
    const user = userEvent.setup(), changed = vi.fn();
    mutation.mockResolvedValueOnce({ data: { before: [{ enrollmentId: 'a', percentage: '100', formalGrade: '5' }], after: [{ enrollmentId: 'a', percentage: '200', formalGrade: '5' }], warnings: ['1 resultado histórico supera el nuevo máximo'], affectedCount: 1, confirmationToken: 'signed-token', expiresAt: new Date(Date.now() + 300000).toISOString() } });
    render(<MaxPointsEditor base="/api/v1/teaching-assignments/a" kind="task" item={{ id: 't', maxPoints: '20', rowVersion: 3 }} onChanged={changed} />);
    await user.click(screen.getByRole('button', { name: 'Cambiar máximo' }));
    await user.clear(screen.getByLabelText('Nuevo máximo'));
    await user.type(screen.getByLabelText('Nuevo máximo'), '10');
    await user.click(screen.getByRole('button', { name: 'Vista previa' }));
    expect(await screen.findByText('1 resultado histórico supera el nuevo máximo')).toBeInTheDocument();
    expect(mutation).toHaveBeenCalledWith('/api/v1/teaching-assignments/a/tasks/t/max-points/preview', 'POST', { newMaxPoints: '10', expectedVersion: 3 });
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(mutation).toHaveBeenCalledTimes(1);
    mutation.mockResolvedValueOnce({ data: { before: [], after: [], warnings: [], affectedCount: 0, confirmationToken: 'second-token', expiresAt: new Date(Date.now() + 300000).toISOString() } }).mockResolvedValueOnce({ data: {} });
    await user.click(screen.getByRole('button', { name: 'Cambiar máximo' }));
    await user.clear(screen.getByLabelText('Nuevo máximo'));
    await user.type(screen.getByLabelText('Nuevo máximo'), '15');
    await user.click(screen.getByRole('button', { name: 'Vista previa' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar cambio' }));
    expect(mutation).toHaveBeenLastCalledWith('/api/v1/teaching-assignments/a/tasks/t/max-points', 'PATCH', { newMaxPoints: '15', expectedVersion: 3, confirmationToken: 'second-token' });
    expect(changed).toHaveBeenCalledOnce();
  });
  it.each([
    ['CONFIRMATION_EXPIRED', 'La confirmación venció. Genera una nueva vista previa.'],
    ['STALE_PREVIEW', 'Los datos cambiaron desde la vista previa. Revísalos y genera una nueva confirmación.'],
  ])('descarta el preview y explica %s', async (code, message) => {
    const user = userEvent.setup();
    mutation.mockResolvedValueOnce({ data: { before: [], after: [], warnings: [], affectedCount: 0, confirmationToken: 'preview-token', expiresAt: new Date(Date.now() + 300000).toISOString() } });
    mutation.mockRejectedValueOnce(new ApiError(409, code, 'Conflicto'));
    render(<MaxPointsEditor base="/api/v1/teaching-assignments/a" kind="task" item={{ id: 't', maxPoints: '20', rowVersion: 3 }} onChanged={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Cambiar máximo' }));
    await user.clear(screen.getByLabelText('Nuevo máximo'));
    await user.type(screen.getByLabelText('Nuevo máximo'), '10');
    await user.click(screen.getByRole('button', { name: 'Vista previa' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar cambio' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('button', { name: 'Confirmar cambio' })).not.toBeInTheDocument();
  });
});

describe('Hito 2B-2: preview de escala en la UI', () => {
  beforeEach(() => mutation.mockReset());
  it.each([
    ['CONFIRMATION_EXPIRED', 'La confirmación venció. Genera una nueva vista previa.'],
    ['STALE_PREVIEW', 'Los datos cambiaron desde la vista previa. Revísalos y genera una nueva confirmación.'],
  ])('descarta el preview y explica %s', async (code, message) => {
    const user = userEvent.setup();
    mutation.mockResolvedValueOnce({ data: { before: [], after: [], warnings: [], affectedCount: 0, confirmationToken: 'preview-token', expiresAt: new Date(Date.now() + 300000).toISOString() } });
    mutation.mockRejectedValueOnce(new ApiError(409, code, 'Conflicto'));
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><GradingScalePanel institutionId="institution" assignmentId="assignment" /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByLabelText('Versión disponible').querySelector('option[value="scale"]')).not.toBeNull());
    await user.selectOptions(screen.getByLabelText('Versión disponible'), 'scale');
    await user.click(screen.getByRole('button', { name: 'Vista previa del cambio de escala' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar escala' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('button', { name: 'Confirmar escala' })).not.toBeInTheDocument();
  });
});
