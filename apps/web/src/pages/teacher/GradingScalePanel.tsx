import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiMutation, apiRequest } from '../../api/client';
import type { TeachingAssignment } from '../../api/types';
import { PermissionGate } from '../../auth/PermissionGate';
import { ErrorNotice, Field, Panel } from '../../components/Ui';

type Scale = { id: string; name: string; version: number; minimumGrade: string; maximumGrade: string; conversionDefinition: unknown; roundingDefinition: unknown; lockedAt: string | null; rowVersion: number };
type Preview = { before: { enrollmentId: string; formalGrade: string | null }[]; after: { enrollmentId: string; formalGrade: string | null }[]; warnings: string[]; affectedCount: number; confirmationToken: string; expiresAt: string };

export function GradingScalePanel({ institutionId, assignmentId }: { institutionId: string; assignmentId: string }) {
  const client = useQueryClient(), [selected, setSelected] = useState(''), [scaleCursor, setScaleCursor] = useState<string | null>(null), [preview, setPreview] = useState<Preview | null>(null), [error, setError] = useState<unknown>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const base = `/api/v1/institutions/${institutionId}/grading-scales`, assignmentBase = `/api/v1/teaching-assignments/${assignmentId}`;
  const scales = useQuery({ queryKey: ['grading-scales', institutionId, scaleCursor], queryFn: () => apiRequest<{ data: Scale[]; nextCursor: string | null }>(`${base}?limit=100${scaleCursor ? `&cursor=${encodeURIComponent(scaleCursor)}` : ''}`), retry: false });
  const applied = useQuery({ queryKey: ['assigned-grading-scale', assignmentId], queryFn: () => apiRequest<{ data: Scale | null }>(`${assignmentBase}/grading-scale`), retry: false });
  const assignment = useQuery({ queryKey: ['grading-assignment', assignmentId], queryFn: async () => (await apiRequest<{ teachingAssignments: TeachingAssignment[] }>('/api/v1/me/teaching-assignments')).teachingAssignments?.find(row => row.id === assignmentId) ?? null });
  const chosen = scales.data?.data?.find(row => row.id === selected);
  const targetId = selected === 'none' ? null : selected;
  const refresh = () => { void client.invalidateQueries({ queryKey: ['grading-scales', institutionId] }); void client.invalidateQueries({ queryKey: ['assigned-grading-scale', assignmentId] }); void client.invalidateQueries({ queryKey: ['grading-assignment', assignmentId] }); void client.invalidateQueries({ queryKey: ['my-teaching-assignments'] }); void client.invalidateQueries({ queryKey: ['process', assignmentId] }); };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(null); setMessage('');
    const form = event.currentTarget, fields = new FormData(form), sourceId = String(fields.get('sourceId') ?? '');
    try {
      const body = { ...(sourceId ? { version: Number(fields.get('version')), expectedVersion: scales.data?.data?.find(row => row.id === sourceId)?.rowVersion } : { name: String(fields.get('name')).trim(), version: 1 }), minimumGrade: String(fields.get('minimumGrade')).trim(), maximumGrade: String(fields.get('maximumGrade')).trim(), conversionDefinition: JSON.parse(String(fields.get('conversionDefinition'))), roundingDefinition: JSON.parse(String(fields.get('roundingDefinition'))) };
      await apiMutation(sourceId ? `${base}/${sourceId}/versions` : base, 'POST', body);
      form.reset(); setMessage('Versión de escala guardada.'); refresh();
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  };
  const inspect = async () => {
    if (!assignment.data || !selected) return;
    setBusy(true); setError(null); setPreview(null);
    try { const result = await apiMutation<{ data: Preview }>(`${assignmentBase}/grading-scale/change-preview`, 'POST', { newGradingScaleId: targetId, expectedAssignmentVersion: assignment.data.rowVersion }); setPreview(result.data); }
    catch (cause) { setError(cause); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!assignment.data || !preview) return;
    setBusy(true); setError(null);
    try { await apiMutation(`${assignmentBase}/grading-scale`, 'PUT', { newGradingScaleId: targetId, expectedAssignmentVersion: assignment.data.rowVersion, confirmationToken: preview.confirmationToken }); setPreview(null); setMessage(targetId ? 'Escala aplicada a la asignación.' : 'Escala retirada de la asignación.'); refresh(); }
    catch (cause) { setError(cause); setPreview(null); }
    finally { setBusy(false); }
  };
  return <PermissionGate permission="grading-scale.read" resourceType="institution" resourceId={institutionId}><Panel title="Escala de calificación" description="La versión aplicada determina la nota formal cuando todas las actividades están evaluadas.">
    <p>Aplicada: {applied.data?.data ? `${applied.data.data.name} · versión ${applied.data.data.version}` : 'Sin escala'}</p>
    {scales.error && <ErrorNotice error={scales.error} />}{applied.error && <ErrorNotice error={applied.error} />}
    <Field label="Versión disponible"><select value={selected} onChange={event => { setSelected(event.target.value); setPreview(null); }}><option value="">Selecciona una escala</option><option value="none">Sin escala</option>{scales.data?.data?.map(row => <option key={row.id} value={row.id}>{row.name} · versión {row.version}</option>)}</select></Field>
    {scales.data?.nextCursor && <button type="button" className="button secondary" onClick={() => { setScaleCursor(scales.data!.nextCursor); setSelected(''); }}>Más escalas</button>}{scaleCursor && <button type="button" className="button secondary" onClick={() => { setScaleCursor(null); setSelected(''); }}>Primeras escalas</button>}
    {chosen && <p>Intervalo {chosen.minimumGrade}–{chosen.maximumGrade}{chosen.lockedAt ? ' · versión usada, inmutable' : ''}</p>}
    <PermissionGate permission="teaching-assignment.manage" resourceType="teaching-assignment" resourceId={assignmentId}>{selected && targetId !== (applied.data?.data?.id ?? null) && <div><button type="button" className="button secondary" disabled={busy} onClick={() => void inspect()}>Vista previa del cambio de escala</button>
      {preview && <div role="status"><p>{preview.affectedCount} matrículas afectadas. Confirma antes de {new Date(preview.expiresAt).toLocaleTimeString()}.</p>{preview.warnings.map(warning => <p key={warning}>{warning}</p>)}<ul>{preview.after.map((row, index) => <li key={row.enrollmentId}>Matrícula {index + 1}: nota {preview.before[index]?.formalGrade ?? '—'} → {row.formalGrade ?? '—'}</li>)}</ul><button type="button" className="button primary" disabled={busy} onClick={() => void confirm()}>Confirmar escala</button><button type="button" className="button secondary" onClick={() => setPreview(null)}>Cancelar</button></div>}
    </div>}</PermissionGate>
    <PermissionGate permission="grading-scale.manage" resourceType="institution" resourceId={institutionId}><form className="stack-form" onSubmit={event => void save(event)}><h3>Crear versión de escala</h3>
      <Field label="Basada en"><select name="sourceId" defaultValue=""><option value="">Escala nueva</option>{scales.data?.data?.map(row => <option key={row.id} value={row.id}>{row.name} · versión {row.version}</option>)}</select></Field>
      <Field label="Nombre (escala nueva)"><input name="name" /></Field><Field label="Número de versión (si deriva de otra)"><input name="version" type="number" min="2" /></Field>
      <Field label="Nota mínima"><input name="minimumGrade" inputMode="decimal" required /></Field><Field label="Nota máxima"><input name="maximumGrade" inputMode="decimal" required /></Field>
      <Field label="Conversión JSON"><textarea name="conversionDefinition" placeholder={'{"schemaVersion":1,"kind":"PERCENTAGE_BANDS","bands":[{"fromPercent":"0","grade":"..."}]}'} required /></Field>
      <Field label="Redondeo JSON"><textarea name="roundingDefinition" placeholder={'{"schemaVersion":1,"kind":"NONE"}'} required /></Field>
      <button className="button primary" disabled={busy}>Guardar versión</button></form></PermissionGate>
    {message && <p role="status" className="notice">{message}</p>}{error !== null && <ErrorNotice error={error} />}
  </Panel></PermissionGate>;
}
