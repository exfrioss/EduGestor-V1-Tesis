import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { friendlyError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function LogoutButton() {
  const auth = useAuth(); const navigate = useNavigate(); const [busy, setBusy] = useState(false);
  const logout = async () => {
    setBusy(true);
    try { await auth.logout(); navigate('/login', { replace: true }); }
    catch (error) { window.alert(friendlyError(error)); setBusy(false); }
  };
  return <button className="sidebar-logout" onClick={() => void logout()} disabled={busy}>{busy ? 'Cerrando…' : 'Cerrar sesión'}</button>;
}
