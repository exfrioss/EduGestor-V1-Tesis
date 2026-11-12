import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, apiMutation, apiRequest } from '../../api/client';
import type { TeachingAssignment } from '../../api/types';
import { PermissionGate } from '../../auth/PermissionGate';
import { EmptyState, ErrorNotice, Field, LoadingState, PageHeader, Panel } from '../../components/Ui';

type Status = 'PRESENTE' | 'AUSENTE' | 'LLEGADA_TARDIA' | 'SALIDA_ANTICIPADA';
type Student = { id: string; givenNames: string; familyNames: string; isActive: boolean };
type Enrollment = { id: string; student: Student };
type Session = { id: string; classDate: string; teachingAssignmentId: string; createdAt: string };
type RecordRow = { id: string; enrollmentId: string; status: Status; isJustified: boolean; justificationObservation: string | null; observation: string | null; rowVersion: number; student: Student };
type Draft = { status: Status | ''; isJustified: boolean; justificationObservation: string; observation: string };
type Page<T> = { data: T[]; nextCursor: string | null };
type HistoryRow = RecordRow & { sessionId: string; classDate: string; subject: { name: string } };
const today = () => { const value = new Date(); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; };
const options: { value: Status; label: string }[] = [
  { value: 'PRESENTE', label: 'Presente' }, { value: 'AUSENTE', label: 'Ausente' },
  { value: 'LLEGADA_TARDIA', label: 'Llegada tardía' }, { value: 'SALIDA_ANTICIPADA', label: 'Salida anticipada' },
];
const draftFor = (record?: RecordRow): Draft => ({ status: record?.status ?? '', isJustified: record?.isJustified ?? false,
  justificationObservation: record?.justificationObservation ?? '', observation: record?.observation ?? '' });

export function AttendancePage() {
  const { institutionId = '', courseId = '', assignmentId = '' } = useParams();
  const client = useQueryClient();
  const [date, setDate] = useState(today);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [message, setMessage] = useState('');
  const [rosterCursor, setRosterCursor] = useState<string | null>(null);
  const [sessionCursor, setSessionCursor] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [periodCursor, setPeriodCursor] = useState<string | null>(null);
  const [historyEnrollmentId, setHistoryEnrollmentId] = useState<string | null>(null);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const base = `/api/v1/teaching-assignments/${assignmentId}/attendance-sessions`;
  const courseBase = `/api/v1/institutions/${institutionId}/courses/${courseId}`;
  const ownAssignments = useQuery({ queryKey: ['my-teaching-assignments'], queryFn: async () => (await apiRequest<{ teachingAssignments: TeachingAssignment[] }>('/api/v1/me/teaching-assignments')).teachingAssignments });
  const subjectId = ownAssignments.data?.find(row => row.id === assignmentId)?.subjectId;

  const sessions = useQuery({ queryKey: ['attendance-sessions', assignmentId, date, sessionCursor], enabled: !!date, queryFn: () =>
    apiRequest<Page<Session>>(`${base}?date=${date}&limit=100${sessionCursor ? `&cursor=${encodeURIComponent(sessionCursor)}` : ''}`) });
  const detail = useQuery({ queryKey: ['attendance-session', assignmentId, selectedSessionId], enabled: !!selectedSessionId, queryFn: () =>
    apiRequest<{ data: { session: Session; records: RecordRow[] } }>(`${base}/${selectedSessionId}`) });
  const roster = useQuery({ queryKey: ['attendance-roster', institutionId, courseId, rosterCursor], enabled: !!selectedSessionId, queryFn: () =>
    apiRequest<Page<Enrollment>>(`${courseBase}/students?limit=100${rosterCursor ? `&cursor=${encodeURIComponent(rosterCursor)}` : ''}`) });
  const period = useQuery({ queryKey: ['attendance-period', institutionId, courseId, subjectId, from, to, periodCursor], enabled: !!subjectId && !!from && !!to && from <= to, queryFn: () =>
    apiRequest<Page<{ sessionId: string; assignmentId: string; subjectId: string; classDate: string }>>(`${courseBase}/attendance-sessions?subjectId=${subjectId}&from=${from}&to=${to}&limit=100${periodCursor ? `&cursor=${encodeURIComponent(periodCursor)}` : ''}`) });
  const history = useQuery({ queryKey: ['attendance-history', institutionId, historyEnrollmentId, assignmentId, historyCursor], enabled: !!historyEnrollmentId, queryFn: () =>
    apiRequest<Page<HistoryRow>>(`/api/v1/institutions/${institutionId}/enrollments/${historyEnrollmentId}/attendance?assignmentId=${assignmentId}&limit=100${historyCursor ? `&cursor=${encodeURIComponent(historyCursor)}` : ''}`) });

  const create = useMutation({ mutationFn: () => apiMutation<{ data: Session }>(base, 'POST', { classDate: date }), onSuccess: result => {
    setSelectedSessionId(result.data.id); setDrafts({}); setMessage('Sesión creada sin marcas automáticas.');
    void client.invalidateQueries({ queryKey: ['attendance-sessions', assignmentId] });
    void client.invalidateQueries({ queryKey: ['attendance-period'] });
  } });
  const save = useMutation({ mutationFn: (records: Array<{ enrollmentId: string; status: Status; isJustified: boolean; justificationObservation: string | null; observation: string | null; expectedVersion: number | null }>) =>
    apiMutation(`${base}/${selectedSessionId}/records/batch`, 'PUT', { records }), onSuccess: () => {
      setDrafts({}); setMessage('Cambios guardados en un solo lote.');
      void client.invalidateQueries({ queryKey: ['attendance-session', assignmentId, selectedSessionId] });
      void client.invalidateQueries({ queryKey: ['attendance-history'] });
    } });
  const records = detail.data?.data.records ?? [];
  const byEnrollment = new Map(records.map(row => [row.enrollmentId, row]));
  const visible = new Map<string, { enrollmentId: string; student: Student }>();
  for (const row of records) visible.set(row.enrollmentId, { enrollmentId: row.enrollmentId, student: row.student });
  for (const row of roster.data?.data ?? []) visible.set(row.id, { enrollmentId: row.id, student: row.student });
  const rows = [...visible.values()].sort((a, b) => `${a.student.familyNames} ${a.student.givenNames}`.localeCompare(`${b.student.familyNames} ${b.student.givenNames}`));
  const update = (enrollmentId: string, change: Partial<Draft>) => {
    if (change.status === '' && !byEnrollment.has(enrollmentId)) {
      setDrafts(current => { const next = { ...current }; delete next[enrollmentId]; return next; });
      return;
    }
    const baseDraft = drafts[enrollmentId] ?? draftFor(byEnrollment.get(enrollmentId));
    setDrafts(current => ({ ...current, [enrollmentId]: { ...baseDraft, ...change } }));
  };
  const selectSession = (id: string) => { setSelectedSessionId(id); setDrafts({}); setMessage(''); setHistoryEnrollmentId(null); };
  const reload = () => { setDrafts({}); setMessage('Datos recargados. Revisa las marcas antes de guardar.'); void client.invalidateQueries({ queryKey: ['attendance-session', assignmentId, selectedSessionId] }); };
  const markPresent = () => {
    const changes: Record<string, Draft> = {};
    for (const row of rows) if (!byEnrollment.has(row.enrollmentId) && row.student.isActive)
      changes[row.enrollmentId] = { status: 'PRESENTE', isJustified: false, justificationObservation: '', observation: '' };
    setDrafts(current => ({ ...current, ...changes }));
  };
  const saveChanges = () => {
    const payload = Object.entries(drafts).flatMap(([enrollmentId, draft]) => draft.status ? [{
      enrollmentId, status: draft.status, isJustified: draft.isJustified,
      justificationObservation: draft.isJustified ? draft.justificationObservation || null : null,
      observation: draft.observation || null, expectedVersion: byEnrollment.get(enrollmentId)?.rowVersion ?? null,
    }] : []);
    if (payload.length) { setMessage(''); save.mutate(payload); }
  };

  return <>
    <PageHeader eyebrow="Materia · espacio de trabajo" title="Asistencia" description="Cada sesión de clase conserva sus marcas propias. Sin marcar no significa presente ni ausente." actions={<Link className="button secondary" to={`/teacher/institutions/${institutionId}/courses/${courseId}/assignments/${assignmentId}/activities`}>Tareas y Evaluaciones</Link>} />
    {message && <p role="status" className="notice">{message}</p>}
    <Panel title="Sesiones del día" description="Puedes crear más de una sesión en la misma fecha; cada una tiene un identificador y registros independientes.">
      <div className="attendance-toolbar"><Field label="Fecha de clase"><input type="date" value={date} onChange={event => { setDate(event.target.value); setSelectedSessionId(null); setSessionCursor(null); setDrafts({}); }} /></Field>
        <PermissionGate permission="attendance.manage" resourceType="teaching-assignment" resourceId={assignmentId}><button className="button primary" disabled={!date || create.isPending} onClick={() => create.mutate()}>Crear otra sesión</button></PermissionGate></div>
      {create.error && <ErrorNotice error={create.error} />}{sessions.isLoading && <LoadingState />}{sessions.error && <ErrorNotice error={sessions.error} />}
      {sessions.data?.data.length === 0 && <EmptyState title="Sin sesiones para esta fecha" description="Crea una sesión cuando vayas a registrar asistencia." />}
      <div className="attendance-session-list">{sessions.data?.data.map(row => <button key={row.id} className={`button secondary ${selectedSessionId === row.id ? 'attendance-selected' : ''}`} onClick={() => selectSession(row.id)}>Sesión {row.classDate} · {row.id.slice(0, 8)}</button>)}</div>
      {sessions.data?.nextCursor && <button className="button secondary" onClick={() => setSessionCursor(sessions.data!.nextCursor)}>Más sesiones</button>}
      {sessionCursor && <button className="button secondary" onClick={() => setSessionCursor(null)}>Primeras sesiones</button>}
    </Panel>
    {selectedSessionId && <Panel title="Marcas de la sesión" description={`Sesión ${detail.data?.data.session.classDate ?? ''}. Los registros existentes son los únicos hechos históricos certificados. La nómina actual se ofrece como ayuda de captura.`}>
      {detail.isLoading || roster.isLoading ? <LoadingState /> : null}{detail.error && <ErrorNotice error={detail.error} />}{roster.error && <ErrorNotice error={roster.error} />}
      <PermissionGate permission="attendance.manage" resourceType="teaching-assignment" resourceId={assignmentId} fallback={<AttendanceTable rows={rows} records={byEnrollment} onHistory={id => { setHistoryEnrollmentId(id); setHistoryCursor(null); }} />}>
        <div className="attendance-actions"><button className="button secondary" onClick={markPresent} disabled={!detail.data || !roster.data}>Marcar presentes sin registrar</button><button className="button primary" onClick={saveChanges} disabled={save.isPending || Object.keys(drafts).length === 0}>Guardar cambios por lote</button><span>{Object.keys(drafts).length} filas modificadas</span></div>
        {save.error && <><ErrorNotice error={save.error} />{save.error instanceof ApiError && (save.error.code === 'STALE_VERSION' || save.error.code === 'CONCURRENT_MODIFICATION') && <button className="button secondary" onClick={reload}>Recargar y revisar versiones</button>}</>}
        <div className="table-wrap"><table className="attendance-table"><thead><tr><th>Estudiante</th><th>Estado</th><th>Justificación</th><th>Observación general</th><th>Historial</th></tr></thead><tbody>{rows.map(row => {
          const existing = byEnrollment.get(row.enrollmentId); const draft = drafts[row.enrollmentId] ?? draftFor(existing);
          const disabled = !existing && !row.student.isActive;
          return <tr key={row.enrollmentId}><td><strong>{row.student.familyNames}, {row.student.givenNames}</strong><small>{existing ? `Marca existente · versión ${existing.rowVersion}` : 'Sin marcar'}{!row.student.isActive ? ' · Inactivo' : ''}</small></td>
            <td><select aria-label={`Estado de ${row.student.givenNames} ${row.student.familyNames}`} value={draft.status} disabled={disabled || save.isPending} onChange={event => update(row.enrollmentId, { status: event.target.value as Status | '' })}>{!existing && <option value="">Sin marcar</option>}{options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></td>
            <td><label className="check"><input type="checkbox" checked={draft.isJustified} disabled={disabled || save.isPending || !draft.status} onChange={event => update(row.enrollmentId, { isJustified: event.target.checked, justificationObservation: event.target.checked ? draft.justificationObservation : '' })} /> Justificada</label><input aria-label={`Observación justificativa de ${row.student.givenNames}`} value={draft.justificationObservation} disabled={disabled || save.isPending || !draft.isJustified} onChange={event => update(row.enrollmentId, { justificationObservation: event.target.value })} placeholder="Observación justificativa" /></td>
            <td><input aria-label={`Observación general de ${row.student.givenNames}`} value={draft.observation} disabled={disabled || save.isPending || !draft.status} onChange={event => update(row.enrollmentId, { observation: event.target.value })} placeholder="Observación general" /></td>
            <td><button className="button small secondary" onClick={() => { setHistoryEnrollmentId(row.enrollmentId); setHistoryCursor(null); }}>Ver historial</button></td></tr>;
        })}</tbody></table></div>
      </PermissionGate>
      {rows.length === 0 && !roster.isLoading && <EmptyState title="Sin matrículas visibles" description="Todavía no hay estudiantes en la nómina actual." />}
      {roster.data?.nextCursor && <button className="button secondary" onClick={() => setRosterCursor(roster.data!.nextCursor)}>Más estudiantes</button>}
      {rosterCursor && <button className="button secondary" onClick={() => setRosterCursor(null)}>Primeros estudiantes</button>}
    </Panel>}
    <Panel title="Consulta por período" description="Sesiones reales del curso, filtradas por fecha. Abre una sesión de esta materia para consultar sus marcas."><div className="attendance-toolbar"><Field label="Desde"><input type="date" value={from} onChange={event => { setFrom(event.target.value); setPeriodCursor(null); }} /></Field><Field label="Hasta"><input type="date" value={to} onChange={event => { setTo(event.target.value); setPeriodCursor(null); }} /></Field></div>{from && to && from > to && <p role="alert">El inicio debe ser anterior o igual al fin.</p>}{period.error && <ErrorNotice error={period.error} />}{period.isLoading && <LoadingState />}{period.data?.data.map(row => <div className="list-item" key={row.sessionId}><span>{row.classDate} · Sesión {row.sessionId.slice(0, 8)}</span>{row.assignmentId === assignmentId && <button className="button small secondary" onClick={() => selectSession(row.sessionId)}>Abrir sesión</button>}</div>)}{period.data?.nextCursor && <button className="button secondary" onClick={() => setPeriodCursor(period.data!.nextCursor)}>Más sesiones</button>}</Panel>
    {historyEnrollmentId && <Panel title="Historial por matrícula" description="Solo se muestran marcas reales de esta matrícula y asignación, con su sesión y fecha.">{history.isLoading && <LoadingState />}{history.error && <ErrorNotice error={history.error} />}{history.data?.data.length === 0 && <EmptyState title="Sin marcas" description="No existen registros para esta matrícula en esta asignación." />}{history.data?.data.map(row => <div className="list-item" key={row.id}><span>{row.classDate} · {row.subject.name} · {options.find(option => option.value === row.status)?.label} · {row.isJustified ? 'Justificada' : 'Sin justificar'}</span><button className="button small secondary" onClick={() => selectSession(row.sessionId)}>Abrir sesión</button></div>)}{history.data?.nextCursor && <button className="button secondary" onClick={() => setHistoryCursor(history.data!.nextCursor)}>Más marcas</button>}{historyCursor && <button className="button secondary" onClick={() => setHistoryCursor(null)}>Primeras marcas</button>}</Panel>}
  </>;
}

function AttendanceTable({ rows, records, onHistory }: { rows: { enrollmentId: string; student: Student }[]; records: Map<string, RecordRow>; onHistory: (enrollmentId: string) => void }) {
  return <div className="table-wrap"><table><thead><tr><th>Estudiante</th><th>Estado</th><th>Justificación</th><th>Observación</th><th>Historial</th></tr></thead><tbody>{rows.map(row => {
    const record = records.get(row.enrollmentId);
    return <tr key={row.enrollmentId}><td>{row.student.familyNames}, {row.student.givenNames}</td><td>{record ? options.find(option => option.value === record.status)?.label : 'Sin marcar'}</td><td>{record?.isJustified ? 'Sí' : 'No'}</td><td>{record?.observation ?? '—'}</td><td><button className="button small secondary" onClick={() => onHistory(row.enrollmentId)}>Ver historial</button></td></tr>;
  })}</tbody></table></div>;
}
