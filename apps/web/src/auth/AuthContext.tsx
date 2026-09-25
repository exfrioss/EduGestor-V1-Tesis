import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiMutation, apiRequest, resetCsrfToken } from '../api/client';
import type { SessionResponse, SessionUser } from '../api/types';

interface AuthContextValue {
  status: 'loading' | 'anonymous' | 'authenticated';
  user: SessionUser | null;
  expiresAt: string | null;
  login(login: string, password: string): Promise<SessionUser>;
  logout(): Promise<void>;
  restore(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const applySession = (session: SessionResponse) => {
    setUser(session.user);
    setExpiresAt(session.session.expiresAt);
    setStatus('authenticated');
  };

  const restore = async () => {
    setStatus('loading');
    try {
      applySession(await apiRequest<SessionResponse>('/api/v1/auth/session'));
    } catch {
      resetCsrfToken();
      setUser(null);
      setExpiresAt(null);
      setStatus('anonymous');
    }
  };

  useEffect(() => {
    void restore();
  }, []);

  useEffect(() => {
    const unauthorized = () => {
      resetCsrfToken();
      setUser(null);
      setExpiresAt(null);
      setStatus('anonymous');
    };
    window.addEventListener('edugestor:unauthorized', unauthorized);
    return () => window.removeEventListener('edugestor:unauthorized', unauthorized);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      expiresAt,
      async login(loginValue, password) {
        resetCsrfToken();
        const session = await apiRequest<SessionResponse>('/api/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({ login: loginValue, password }),
        });
        applySession(session);
        return session.user;
      },
      async logout() {
        await apiMutation<void>('/api/v1/auth/logout', 'POST');
        resetCsrfToken();
        setUser(null);
        setExpiresAt(null);
        setStatus('anonymous');
      },
      restore,
    }),
    [expiresAt, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (value === null) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return value;
};
