import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LogoutButton } from '../components/LogoutButton';

export function AdminLayout() {
  const { institutionId } = useParams();
  const auth = useAuth();
  const base = institutionId ? `/admin/institutions/${institutionId}` : null;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand"><span className="brand-mark">E</span><span>EduGestor<small>Administración</small></span></NavLink>
        <nav aria-label="Administración">
          <NavLink to="/admin/institutions">Instituciones</NavLink>
          {base && <>
            <NavLink to={`${base}/teachers`}>Docentes</NavLink>
            <NavLink to={`${base}/academic`}>Año y cursos</NavLink>
            <NavLink to={`${base}/subjects`}>Materias</NavLink>
            <NavLink to={`${base}/assignments`}>Asignaciones</NavLink>
          </>}
          {auth.user?.teacher && <NavLink to="/teacher/assignments">Mis asignaciones</NavLink>}
        </nav>
        <div className="sidebar-user"><span>{auth.user?.login}</span><small>{auth.user?.accountKind === 'TECHNICAL' ? 'Cuenta técnica' : 'Cuenta estándar'}</small><LogoutButton /></div>
      </aside>
      <main className="main-content"><Outlet /></main>
    </div>
  );
}
