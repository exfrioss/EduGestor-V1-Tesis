import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, apiMutation, apiRequest } from '../api/client';
import type { Course } from '../api/types';
import { PermissionGate } from '../auth/PermissionGate';
import { EmptyState, ErrorNotice, Field, LoadingState, PageHeader, Panel } from '../components/Ui';

type Student = { id: string; givenNames: string; familyNames: string; nationalId: string | null; isActive: boolean; rowVersion: number };
type Enrollment = { id: string; studentId: string; courseId: string; academicYearId: string; createdAt: string; student: Student };
type SearchHit = { student: Student; enrollments: Enrollment[] };
type Page<T> = { data: T[]; nextCursor: string | null };

export function StudentsPage() {
  const { institutionId = '', courseId = '', assignmentId } = useParams();
  const client = useQueryClient();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const base = `/api/v1/institutions/${institutionId}`;
  const course = useQuery({ queryKey: ['course', courseId], queryFn: async () => (await apiRequest<{ course: Course }>(`/api/v1/courses/${courseId}`)).course });
  const roster = useQuery({ queryKey: ['roster', institutionId, courseId, cursor], queryFn: () => apiRequest<Page<Enrollment>>(`${base}/courses/${courseId}/students${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`) });
  const search = useQuery({ queryKey: ['student-search', institutionId, courseId, q], queryFn: async () => {
    try { return await apiRequest<Page<SearchHit>>(`${base}/students?q=${encodeURIComponent(q)}`); }
    catch (error) { if (error instanceof ApiError && error.status === 403) return apiRequest<Page<SearchHit>>(`${base}/students?courseId=${courseId}&q=${encodeURIComponent(q)}`); throw error; }
  }, enabled: q.trim().length > 0 });
  const details = useQuery({ queryKey: ['student-details', selected, courseId, assignmentId], queryFn: async () => {
    const path = `${base}/students/${selected}`;
    if (assignmentId) return apiRequest<{ data: { student: Student; enrollments: Enrollment[] } }>(`${path}?courseId=${courseId}`);
    try { return await apiRequest<{ data: { student: Student; enrollments: Enrollment[] } }>(path); }
    catch (error) { if (error instanceof ApiError && (error.status === 400 || error.status === 403)) return apiRequest<{ data: { student: Student; enrollments: Enrollment[] } }>(`${path}?courseId=${courseId}`); throw error; }
  }, enabled: !!selected });
  const refresh = () => { void client.invalidateQueries({ queryKey: ['roster', institutionId, courseId] }); void client.invalidateQueries({ queryKey: ['student-search', institutionId, courseId] }); };
  const newStudent = useMutation({
    mutationFn: (body: unknown) => apiMutation(`${base}/courses/${courseId}/students`, 'POST', body),
    onSuccess: () => { setMessage('Estudiante registrado y matriculado.'); refresh(); },
  });
  const enroll = useMutation({
    mutationFn: (studentId: string) => apiMutation(`${base}/courses/${courseId}/enrollments`, 'POST', { studentId, academicYearId: course.data!.academicYearId }),
    onSuccess: () => { setMessage('Matrícula creada.'); refresh(); },
  });
  const submitNew = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setMessage('');
    const form = event.currentTarget; const data = new FormData(form);
    newStudent.mutate({ givenNames: String(data.get('givenNames')), familyNames: String(data.get('familyNames')),
      nationalId: String(data.get('nationalId')).trim() || null, academicYearId: course.data!.academicYearId }, { onSuccess: () => form.reset() });
  };
  const conflict = (error: unknown) => error instanceof ApiError && error.status === 409
    ? 'No se pudo completar la operación: existe un conflicto con los datos registrados.' : null;

  return <>
    <PageHeader eyebrow={assignmentId ? 'Materia · Perfiles de Alumnos' : 'Institución · Curso · Estudiantes'} title={assignmentId ? 'Perfiles de Alumnos' : 'Estudiantes'} description={course.data ? `${course.data.grade} · Sección ${course.data.section} · ${course.data.academicYear.label}` : 'Nómina y matrícula del curso.'} />
    {course.isLoading && <LoadingState />}{course.error && <ErrorNotice error={course.error} />}
    {message && <p role="status" className="notice">{message}</p>}
    <Panel title="Nómina" description="Identidad y matrícula en este curso y año lectivo.">
      {roster.isLoading && <LoadingState />}{roster.error && <ErrorNotice error={roster.error} />}
      {roster.data?.data.length === 0 && <EmptyState title="Sin estudiantes" description="No hay matrículas visibles para este curso." />}
      <div className="list-stack">{roster.data?.data.map(row => <div className="list-item" key={row.id}><div><strong>{row.student.familyNames}, {row.student.givenNames}</strong><small>Matrícula {row.id} · {row.student.nationalId ?? 'Sin cédula'}</small></div><div>{!row.student.isActive && <span className="badge">Inactivo</span>}<button className="button small secondary" onClick={() => setSelected(row.studentId)}>Ver perfil</button></div></div>)}</div>
      {roster.data?.nextCursor && <button className="button secondary" onClick={() => setCursor(roster.data!.nextCursor)}>Siguiente página</button>}
      {cursor && <button className="button secondary" onClick={() => setCursor(null)}>Primera página</button>}
    </Panel>
    {selected && <Panel title="Perfil contextual" description="Solo se muestra la identidad y el historial de matrículas autorizadas.">{details.isLoading && <LoadingState />}{details.error && <ErrorNotice error={details.error} />}{details.data && <><p><strong>{details.data.data.student.givenNames} {details.data.data.student.familyNames}</strong> · {details.data.data.student.isActive ? 'Activo' : 'Inactivo'}</p><p>Cédula: {details.data.data.student.nationalId ?? 'No informada'}</p><p>Matrículas visibles:</p><ul>{details.data.data.enrollments.map(row => <li key={row.id}>Curso {row.courseId} · Año lectivo {row.academicYearId} · Matrícula {row.id}</li>)}</ul></>}</Panel>}
    {!assignmentId && course.data && <div className="two-column">
      <Panel title="Buscar antes de matricular" description="Se muestran únicamente estudiantes que ya puedes consultar en este contexto.">
        <Field label="Nombre o cédula"><input value={q} onChange={event => setQ(event.target.value)} placeholder="Buscar estudiante visible" /></Field>
        {search.isLoading && <LoadingState />}{search.error && <ErrorNotice error={search.error} />}
        <div className="list-stack">{search.data?.data.map(hit => <div className="list-item" key={hit.student.id}><div><strong>{hit.student.familyNames}, {hit.student.givenNames}</strong><small>{hit.student.nationalId ?? 'Sin cédula'} · {hit.student.isActive ? 'Activo' : 'Inactivo'}</small></div><PermissionGate permission="enrollment.manage" resourceType="course" resourceId={courseId}><button className="button small" disabled={!hit.student.isActive || enroll.isPending || hit.enrollments.some(row => row.courseId === courseId)} onClick={() => enroll.mutate(hit.student.id)}>Matricular</button></PermissionGate></div>)}</div>
        {search.data?.data.length === 0 && <p>No hay coincidencias visibles.</p>}
        {enroll.error && <p role="alert">{conflict(enroll.error) ?? <ErrorNotice error={enroll.error} />}</p>}
      </Panel>
      <Panel title="Registrar estudiante" description={`Primera matrícula en ${course.data.grade}, sección ${course.data.section}, año ${course.data.academicYear.label}.`}>
        <PermissionGate permission="student.manage" resourceType="course" resourceId={courseId}><PermissionGate permission="enrollment.manage" resourceType="course" resourceId={courseId}>
          <form className="stack-form" onSubmit={submitNew}><Field label="Nombres"><input name="givenNames" required /></Field><Field label="Apellidos"><input name="familyNames" required /></Field><Field label="Cédula (opcional)"><input name="nationalId" /></Field><button className="button primary" disabled={newStudent.isPending}>Registrar y matricular</button></form>
        </PermissionGate></PermissionGate>
        {newStudent.error && <p role="alert">{conflict(newStudent.error) ?? <ErrorNotice error={newStudent.error} />}</p>}
      </Panel>
    </div>}
  </>;
}
