import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { LoadingState } from '../components/Ui';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiRequest } from '../api/client';
import type { Institution } from '../api/types';

export function RequireAuthenticated() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <main className="center-page"><LoadingState label="Restaurando sesión…" /></main>;
  if (auth.status === 'anonymous') return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <Outlet />;
}

export function AnonymousOnly({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth.status === 'loading') return <main className="center-page"><LoadingState label="Restaurando sesión…" /></main>;
  return auth.status === 'authenticated' ? <Navigate to="/" replace /> : children;
}

export function RequireAdminAccess() {
  const auth = useAuth();
  const access = useQuery({
    queryKey: ['institutions'],
    queryFn: async () => {
      try { return (await apiRequest<{ institutions: Institution[] }>('/api/v1/institutions')).institutions; }
      catch (error) { if (error instanceof ApiError && error.status === 403) return []; throw error; }
    },
    retry: false,
  });
  if (access.isLoading) return <main className="center-page"><LoadingState label="Comprobando acceso administrativo…" /></main>;
  if ((access.data?.length ?? 0) === 0 && auth.user?.accountKind !== 'TECHNICAL') {
    return <Navigate to={auth.user?.teacher ? '/teacher/assignments' : '/forbidden'} replace />;
  }
  return <Outlet />;
}
