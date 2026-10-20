import {
  CaretLeft,
  CaretRight,
  ClockCounterClockwise,
  List,
  MapPin,
  Pulse,
  Ticket,
  TrendUp,
  Wrench,
  X,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { dailyCycle } from '../time';
import { useTenant } from '../tenant/TenantContext';
import { TenantSwitcher } from './TenantSwitcher';
import { UserMenu } from './UserMenu';

export type WorkspaceView = 'summary' | 'sales' | 'history' | 'sites' | 'admin' | 'monitoring';

type Props = {
  activeView: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
  children: ReactNode;
};

const navigation: Array<{ view: WorkspaceView; label: string; icon: typeof TrendUp }> = [
  { view: 'summary', label: 'Resumen', icon: TrendUp },
  { view: 'sales', label: 'Ventas', icon: Ticket },
  { view: 'history', label: 'Histórico', icon: ClockCounterClockwise },
  { view: 'sites', label: 'Destinos', icon: MapPin },
  { view: 'admin', label: 'Administración', icon: Wrench },
  { view: 'monitoring', label: 'Monitoreo', icon: Pulse },
];

export function AppShell({ activeView, onNavigate, children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const { activeSite, closureHour } = useTenant();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const cycle = dailyCycle(clock, activeSite?.timezone, closureHour);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 980) setDrawerOpen(false);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDrawerOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  function navigate(view: WorkspaceView) {
    onNavigate(view);
    setDrawerOpen(false);
  }

  return (
    <main
      className={`app-shell ${drawerOpen ? 'drawer-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`.trim()}
    >
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <button
        className="mobile-menu"
        type="button"
        aria-label="Abrir navegación"
        aria-controls="app-sidebar"
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(true)}
      >
        <List size={22} aria-hidden="true" />
      </button>
      <button className="drawer-scrim" type="button" aria-label="Cerrar navegación" onClick={() => setDrawerOpen(false)} />
      <div className="app-layout">
        <aside className="sidebar" id="app-sidebar" aria-label="Navegación principal">
          <div className="sidebar-top">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">AF</span>
              <div><b>Afluencia</b><span>Operación turística</span></div>
            </div>
            <button
              className="brand-toggle"
              type="button"
              aria-label="Mostrar menú lateral"
              title="Mostrar menú lateral"
              onClick={() => setSidebarCollapsed(false)}
            >
              <span className="brand-mark" aria-hidden="true">AF</span>
              <CaretRight size={14} aria-hidden="true" />
            </button>
            <button
              className="sidebar-collapse"
              type="button"
              aria-label="Ocultar menú lateral"
              title="Ocultar menú lateral"
              onClick={() => setSidebarCollapsed(true)}
            >
              <CaretLeft size={20} aria-hidden="true" />
            </button>
            <button ref={closeButtonRef} className="sidebar-close" type="button" aria-label="Cerrar navegación" onClick={() => setDrawerOpen(false)}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <TenantSwitcher />
          <nav className="sidebar-nav" aria-label="Vistas de la consola">
            {navigation.map(({ view, label, icon: Icon }) => (
              <button
                key={view}
                type="button"
                className={activeView === view ? 'active' : ''}
                aria-label={label}
                aria-current={activeView === view ? 'page' : undefined}
                data-tooltip={label}
                onClick={() => navigate(view)}
              >
                <Icon size={19} weight={activeView === view ? 'fill' : 'regular'} aria-hidden="true" />
                <span className="nav-label">{label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-status" aria-live="polite">
            <span className={`sidebar-status__dot ${cycle.registrationOpen ? 'is-closing' : ''}`} aria-hidden="true" />
            <span>{cycle.registrationOpen ? 'Cierre automático en proceso' : `Cierre automático a las ${closureHour}:00`}</span>
          </div>
          <UserMenu />
        </aside>

        <section className="workspace" id="main-content" aria-label="Contenido de la consola">
          <div className="workspace-topbar">
            <p className="workspace-topbar__site"><MapPin size={16} weight="duotone" aria-hidden="true" /> {activeSite?.name ?? 'Sin destino activo'}</p>
            <span className={`time-pill ${cycle.registrationOpen ? 'is-closing' : ''}`}>
              {cycle.registrationOpen ? 'Procesando cierre' : 'Operación abierta'}
            </span>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
