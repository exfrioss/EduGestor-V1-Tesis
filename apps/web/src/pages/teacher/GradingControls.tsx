import { useState, type FormEvent } from 'react';
import { apiMutation } from '../../api/client';
import { ErrorNotice, Field } from '../../components/Ui';

type Preview = { before: { enrollmentId: string; percentage: string | null; formalGrade: string | null }[]; after: { enrollmentId: string; percentage: string | null; formalGrade: string | null }[]; warnings: string[]; affectedCount: number; confirmationToken: string; expiresAt: string };

export function MaxPointsEditor({ base, kind, item, onChanged }: { base: string; kind: 'task' | 'assessment'; item: { id: string; maxPoints: string; rowVersion: number }; onChanged: () => void }) {
  const [open, setOpen] = useState(false), [value, setValue] = useState(item.maxPoints);
  const [preview, setPreview] = useState<Preview | null>(null), [error, setError] = useState<unknown>(null), [busy, setBusy] = useState(false);
  const path = `${base}/${kind === 'task' ? 'tasks' : 'assessments'}/${item.id}/max-points`;
  const close = () => { setOpen(false); setPreview(null); setError(null); setValue(item.maxPoints); };
  const inspect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(null); setPreview(null); setBusy(true);
    try { const result = await apiMutation<{ data: Preview }>(`${path}/preview`, 'POST', { newMaxPoints: value, expectedVersion: item.rowVersion }); setPreview(result.data); }
    catch (cause) { setError(cause); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!preview) return;
    setError(null); setBusy(true);
    try { await apiMutation(path, 'PATCH', { newMaxPoints: value, expectedVersion: item.rowVersion, confirmationToken: preview.confirmationToken }); close(); onChanged(); }
    catch (cause) { setError(cause); setPreview(null); }
    finally { setBusy(false); }
  };
  return <div>
    {!open ? <button type="button" className="button small secondary" onClick={() => setOpen(true)}>Cambiar máximo</button> : <form className="stack-form" onSubmit={inspect}>
      <Field label="Nuevo máximo"><input value={value} onChange={event => { setValue(event.target.value); setPreview(null); }} inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,4})?" required /></Field>
      <button className="button secondary" disabled={busy}>Vista previa</button><button type="button" className="button secondary" onClick={close}>Cancelar</button>
      {preview && <div role="status"><p>{preview.affectedCount} matrículas afectadas. Confirma antes de {new Date(preview.expiresAt).toLocaleTimeString()}.</p>
        {preview.warnings.map(warning => <p key={warning}>{warning}</p>)}
        <ul>{preview.after.map((after, index) => <li key={after.enrollmentId}>Matrícula {index + 1}: {preview.before[index]?.percentage ?? '—'} % → {after.percentage ?? '—'} %; nota {preview.before[index]?.formalGrade ?? '—'} → {after.formalGrade ?? '—'}</li>)}</ul>
        <button type="button" className="button primary" disabled={busy} onClick={() => void confirm()}>Confirmar cambio</button>
      </div>}
      {error !== null && <ErrorNotice error={error} />}
    </form>}
  </div>;
}
