import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import type { TeachingAssignment } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, ErrorNotice, LoadingState, PageHeader } from '../../components/Ui';

export function MyAssignmentsPage() {
  const auth = useAuth();
  const query = useQuery({ queryKey: ['my-teaching-assignments'], queryFn: async () => (await apiRequest<{ teachingAssignments: TeachingAssignment[] }>('/api/v1/me/teaching-assignments')).teachingAssignments, retry: false });
  return <><PageHeader eyebrow="Portal docente" title="Mis asignaciones" description={`Hola, ${auth.user?.teacher?.displayName ?? auth.user?.login}. Estos son tus contextos académicos vigentes.`} />{query.isLoading && <LoadingState label="Cargando tus asignaciones…" />}{query.error && <ErrorNotice error={query.error} />}{query.data?.length === 0 && <EmptyState title="No tienes asignaciones vigentes" description="Cuando un administrador te asigne un curso y una materia, aparecerán aquí." />}<div className="assignment-grid">{query.data?.map((item) => <article className="assignment-card" key={item.id}><div className="assignment-accent" /><div><p className="eyebrow">{item.institution.name}</p><h2>{item.subject.name}</h2><dl><div><dt>Año lectivo</dt><dd>{item.course.academicYear.label}</dd></div><div><dt>Año / grado</dt><dd>{item.course.grade}</dd></div><div><dt>Sección</dt><dd>{item.course.section}</dd></div><div><dt>Turno</dt><dd>{item.course.shift}</dd></div></dl><Link className="button small secondary" to={`/teacher/institutions/${item.institution.id}/courses/${item.course.id}/assignments/${item.id}/students`}>Perfiles de Alumnos</Link></div></article>)}</div></>;
}
