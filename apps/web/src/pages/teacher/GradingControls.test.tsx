import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaxPointsEditor } from './GradingControls';

const mutation = vi.fn();
vi.mock('../../api/client', () => ({ apiMutation: (...args: unknown[]) => mutation(...args), friendlyError: (error: unknown) => String(error) }));

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
});
