import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import type { Institution } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { LoadingState } from '../components/Ui';

export function LandingPage() {
  const auth = useAuth();
  const probe = useQuery({
    queryKey: ['landing'],
    queryFn: async () => {
      try {
        const { institutions } = await apiRequest<{ institutions: Institution[] }>('/api/v1/institutions');
        if (institutions.length > 0 || auth.user?.accountKind === 'TECHNICAL') return '/admin/institutions';
      } catch (error) { if (!(error instanceof ApiError) || error.status !== 403) throw error; }
      return auth.user?.teacher ? '/teacher/assignments' : '/forbidden';
    }, retry: false,
  });
  if (!probe.data) return <main className="center-page"><LoadingState label="Preparando tu espacio…" /></main>;
  return <Navigate to={probe.data} replace />;
}

function ErrorPage({ code, title, message }: { code: string; title: string; message: string }) {
  return <main className="error-page"><span>{code}</span><h1>{title}</h1><p>{message}</p><Link className="button primary" to="/">Volver al inicio</Link></main>;
}
export const ForbiddenPage = () => <ErrorPage code="403" title="Acceso restringido" message="Tu cuenta no tiene una concesión válida para este recurso. Si crees que es un error, consulta con un administrador." />;
export const NotFoundPage = () => <ErrorPage code="404" title="Página no encontrada" message="La dirección no existe o fue movida." />;
