import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest, friendlyError } from '../api/client';
import type { Institution, SessionUser } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Field } from '../components/Ui';

export async function landingFor(user: SessionUser): Promise<string> {
  try {
    const { institutions } = await apiRequest<{ institutions: Institution[] }>('/api/v1/institutions');
    if (institutions.length > 0 || user.accountKind === 'TECHNICAL') return '/admin/institutions';
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 403) throw error;
  }
  return user.teacher ? '/teacher/assignments' : '/forbidden';
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const user = await auth.login(String(data.get('login')), String(data.get('password')));
      navigate(await landingFor(user), { replace: true });
    } catch (caught) { setError(caught); }
    finally { setBusy(false); }
  };

  return (
    <main className="login-page">
      <section className="login-story"><div className="brand light"><span className="brand-mark">E</span><span>EduGestor<small>V1.0</small></span></div><div><p className="eyebrow">Gestión educativa, sin ruido</p><h1>Todo el contexto académico en un solo lugar.</h1><p>Administra instituciones, docentes, cursos, materias y asignaciones con trazabilidad y permisos por ámbito.</p></div><p className="login-footnote">Hito 1 · Acceso institucional y docente</p></section>
      <section className="login-form-wrap"><form className="login-card" onSubmit={submit}><div><p className="eyebrow">Bienvenido</p><h2 data-route-heading tabIndex={-1}>Inicia sesión</h2><p>Utiliza la cuenta provista por tu institución.</p></div>{error !== null && <div className="notice notice-error" role="alert">{friendlyError(error)}</div>}<Field label="Usuario"><input name="login" autoComplete="username" required data-route-initial-focus /></Field><Field label="Contraseña"><input name="password" type="password" autoComplete="current-password" required /></Field><button className="button primary full" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar a EduGestor'}</button><small className="privacy-note">La sesión se mantiene en una cookie segura. EduGestor no guarda tokens en el navegador.</small></form></section>
    </main>
  );
}
