import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { LoginPage } from '../components/LoginPage';

// AuthGuard equivalent: without a live in-memory session the only surface is
// the login page. An expired token is cleared by the API client on 401.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();
  if (!authenticated) return <LoginPage />;
  return <>{children}</>;
}
