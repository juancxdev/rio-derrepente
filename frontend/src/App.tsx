import { useEffect, useState } from 'react';
import { AuthProvider } from './auth/AuthProvider';
import { AppShell, type WorkspaceView } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { TenantProvider, useTenant } from './tenant/TenantContext';
import { PlatformConsole } from './platform/PlatformConsole';
import { AdminView } from './views/AdminView';
import { DestinationsView } from './views/DestinationsView';
import { HistoryView } from './views/HistoryView';
import { MonitoringView } from './views/MonitoringView';
import { SalesView } from './views/SalesView';
import { SummaryView } from './views/SummaryView';

const views: WorkspaceView[] = ['summary', 'sales', 'history', 'sites', 'admin', 'monitoring'];

function viewFromHash(): WorkspaceView {
  const value = window.location.hash.replace('#', '');
  return views.includes(value as WorkspaceView) ? (value as WorkspaceView) : 'summary';
}

const titles: Record<WorkspaceView, string> = {
  summary: 'Resumen operativo',
  sales: 'Ventas',
  history: 'Histórico',
  sites: 'Destinos',
  admin: 'Administración',
  monitoring: 'Monitoreo',
};

function Workspace() {
  const [view, setView] = useState<WorkspaceView>(viewFromHash);

  useEffect(() => {
    function onHashChange() {
      setView(viewFromHash());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = `${titles[view]} · Afluencia`;
  }, [view]);

  function navigate(next: WorkspaceView) {
    setView(next);
    window.history.replaceState(null, '', `#${next}`);
  }

  return (
    <AppShell activeView={view} onNavigate={navigate}>
      {view === 'summary' ? <SummaryView /> : null}
      {view === 'sales' ? <SalesView /> : null}
      {view === 'history' ? <HistoryView /> : null}
      {view === 'sites' ? <DestinationsView /> : null}
      {view === 'admin' ? <AdminView /> : null}
      {view === 'monitoring' ? <MonitoringView /> : null}
    </AppShell>
  );
}

function AuthenticatedHome() {
  const { user, role } = useTenant();
  if (user?.is_super_admin || role === 'super_admin') return <PlatformConsole />;
  return <Workspace />;
}

export default function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <ProtectedRoute>
          <AuthenticatedHome />
        </ProtectedRoute>
      </TenantProvider>
    </AuthProvider>
  );
}
