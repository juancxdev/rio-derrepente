import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { LoginPage } from '../components/LoginPage';

// AuthGuard equivalent: AuthProvider first attempts to restore the session
// through the HttpOnly refresh cookie before showing the login page.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();
  if (!authenticated) return <LoginPage />;
  return <>{children}</>;
}
