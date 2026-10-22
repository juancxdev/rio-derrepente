import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { login as loginRequest, logout as logoutRequest, refreshSession } from '../api/auth';
import { setAuthToken, setUnauthorizedHandler } from '../api/client';
import type { SessionResponse } from '../types';

type AuthContextValue = {
  session: SessionResponse | null;
  authenticated: boolean;
  notice: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  clearNotice: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const restoreSession = useCallback(async (): Promise<boolean> => {
    try {
      const next = await refreshSession();
      setAuthToken(next.access_token ?? null);
      setSession(next);
      setNotice(null);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      const restored = await restoreSession();
      if (!restored) {
        setAuthToken(null);
        setSession(null);
        setNotice('La sesión venció. Inicia sesión nuevamente para continuar.');
      }
      return restored;
    });
    void restoreSession();
    return () => setUnauthorizedHandler(null);
  }, [restoreSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await loginRequest(email, password);
    setAuthToken(next.access_token ?? null);
    setSession(next);
    setNotice(null);
  }, []);

  const signOut = useCallback(() => {
    void logoutRequest().catch(() => undefined);
    setAuthToken(null);
    setSession(null);
    setNotice(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    authenticated: session !== null,
    notice,
    signIn,
    signOut,
    clearNotice: () => setNotice(null),
  }), [session, notice, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
