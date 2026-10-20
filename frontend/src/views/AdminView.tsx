import { ArrowClockwise, Clock, Wrench } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { getClosureStatus } from '../api/ticketing';
import { Alert, Badge, Button, Card, Metric, PageHeader, Skeleton } from '../design-system';
import { useTenant } from '../tenant/TenantContext';
import { dailyCycle, formatLongDate } from '../time';
import type { ClosureStatus } from '../types';

const roleCopy: Record<string, string> = {
  operator: 'Puedes consultar la operación y emitir tickets. No puedes crear destinos ni importar históricos.',
  manager: 'Puedes operar la venta, crear destinos e importar históricos del tenant.',
  admin: 'Tienes acceso completo a la configuración y operación del tenant.',
};

export function AdminView() {
  const { tenant, activeSite, role, closureHour } = useTenant();
  const [closure, setClosure] = useState<ClosureStatus | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const cycle = dailyCycle(new Date(), activeSite?.timezone, closureHour);

  useEffect(() => {
    if (!tenant || !activeSite) return;
    let cancelled = false;
    setError(false);
    setClosure(null);
    getClosureStatus(tenant.id, activeSite.id, cycle.today)
      .then((status) => { if (!cancelled) setClosure(status); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [tenant, activeSite, cycle.today, reloadKey]);

  return (
    <>
      <PageHeader
        eyebrow="Configuración"
        title="Administración"
        description="Estado del cierre automático y alcance del rol autenticado. La configuración sensible vive en el backend."
        actions={<Button variant="secondary" icon={ArrowClockwise} onClick={() => setReloadKey((value) => value + 1)}>Actualizar</Button>}
      />

      {!tenant || !activeSite ? (
        <Alert tone="warning" title="Sin destino activo">Selecciona un destino del tenant para consultar el cierre diario.</Alert>
      ) : (
        <>
          <div className="metric-row">
            <Metric label="Tenant" value={tenant.name} hint="Origen: token de sesión" tone="accent" />
            <Metric label="Rol actual" value={<Badge tone="accent">{role ?? 'Sin rol'}</Badge>} hint="Define las acciones permitidas" />
            <Metric
              label="Cierre del día"
              value={closure ? <Badge tone={closure.status === 'ready' ? 'success' : closure.status === 'processing' ? 'warning' : 'neutral'}>{closure.status === 'ready' ? 'Listo' : closure.status === 'processing' ? 'Procesando' : 'Pendiente'}</Badge> : <Skeleton variant="text" label="" />}
              hint={formatLongDate(cycle.today, activeSite.timezone)}
            />
          </div>

          {error ? (
            <Alert tone="danger" title="No pudimos consultar el cierre" action={<Button size="sm" variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>Reintentar</Button>}>
              El estado del Worker se consulta en la API. No se muestra información inventada.
            </Alert>
          ) : null}

          <div className="admin-grid">
            <Card>
              <div className="section-heading">
                <div>
                  <h2>Cierre diario automático</h2>
                  <p>El Worker consolida los tickets del destino, registra el clima observado y publica el evento de entrenamiento.</p>
                </div>
                <span className="status-pill">{cycle.registrationOpen ? 'En proceso' : `A las ${closureHour}:00`}</span>
              </div>
              <p className="admin-copy">
                Las ventas emitidas hoy se convierten en la afluencia real cuando termina la jornada. La predicción de mañana se consulta
                desde la API después del cierre.
              </p>
              <dl className="admin-facts">
                <div><dt>Tickets del día</dt><dd>{closure ? closure.tickets : 'Consultando'}</dd></div>
                <div><dt>Predicción persistida</dt><dd>{closure?.prediction_available ? 'Disponible' : 'Todavía no'}</dd></div>
                <div><dt>Evento publicado</dt><dd>{closure?.event_published_at ? new Date(closure.event_published_at).toLocaleString('es-PE') : 'Sin publicar'}</dd></div>
              </dl>
              {closure?.event_error ? <Alert tone="warning" title="El Worker reportó un error">{closure.event_error}</Alert> : null}
            </Card>

            <Card>
              <div className="section-heading">
                <div>
                  <h2>Alcance del rol</h2>
                  <p>{role ? roleCopy[role] : 'Sin rol asignado.'}</p>
                </div>
                <Wrench size={22} weight="duotone" aria-hidden="true" />
              </div>
              <ul className="guide-list">
                <li><Clock size={18} weight="duotone" aria-hidden="true" /> El cierre se calcula con la zona horaria del destino activo.</li>
                <li>Las rutas heredadas de visitas quedan deshabilitadas por defecto y la interfaz principal no las usa.</li>
                <li>Los cambios de configuración se aplican en el backend; la consola solo refleja el estado autenticado.</li>
              </ul>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
