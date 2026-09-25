import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiRequest } from '../api/client';
import type { Institution } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { LogoutButton } from '../components/LogoutButton';

export function TeacherLayout() {
  const auth = useAuth();
  const adminProbe = useQuery({
    queryKey: ['institutions', 'navigation-probe'],
    queryFn: async () => {
      try { return (await apiRequest<{ institutions: Institution[] }>('/api/v1/institutions')).institutions; }
      catch (error) { if (error instanceof ApiError && error.status === 403) return []; throw error; }
    },
    retry: false,
  });
  return (
    <div className="app-shell">
      <aside className="sidebar teacher-sidebar">
        <NavLink to="/" className="brand"><span className="brand-mark">E</span><span>EduGestor<small>Portal docente</small></span></NavLink>
        <nav aria-label="Docente"><NavLink to="/teacher/assignments">Mis asignaciones</NavLink>{(adminProbe.data?.length ?? 0) > 0 && <NavLink to="/admin/institutions">Administración</NavLink>}</nav>
        <div className="sidebar-user"><span>{auth.user?.teacher?.displayName ?? auth.user?.login}</span><small>{auth.user?.login}</small><LogoutButton /></div>
      </aside>
      <main className="main-content"><Outlet /></main>
    </div>
  );
}
