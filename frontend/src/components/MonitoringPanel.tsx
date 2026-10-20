import { ArrowClockwise, CloudCheck, Database, Pulse } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { getHealth, type HealthStatus } from '../api/health';
import { Alert, Badge, Button, Card, EmptyState, Skeleton } from '../design-system';

export function MonitoringPanel() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setError(false);
    setLoading(true);
    try {
      setHealth(await getHealth());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  return (
    <div className="monitoring-panel">
      <div className="section-heading">
        <div>
          <h2>Estado de los servicios</h2>
          <p>La API responde desde el backend desplegado. Los detalles técnicos se revisan en la infraestructura.</p>
        </div>
        <Button variant="secondary" size="sm" icon={ArrowClockwise} onClick={() => void refresh()} loading={loading}>
          Actualizar estado
        </Button>
      </div>

      {error ? (
        <Alert tone="danger" title="Sin respuesta de la API" action={<Button size="sm" variant="secondary" onClick={() => void refresh()}>Reintentar</Button>}>
          No pudimos consultar el estado del servicio. Revisa que el backend esté en ejecución.
        </Alert>
      ) : null}

      <div className="service-status-grid">
        <Card className="service-status">
          <span className="service-status__icon"><Pulse size={22} weight="duotone" aria-hidden="true" /></span>
          <span className="service-status__label">API principal</span>
          {loading ? <Skeleton variant="text" label="Consultando API" /> : <><b>{health?.service ?? 'Sin datos'}</b><Badge tone={error ? 'danger' : health ? 'success' : 'neutral'}>{error ? 'Sin respuesta' : health ? 'Operativa' : 'Sin datos'}</Badge></>}
        </Card>
        <Card className="service-status">
          <span className="service-status__icon"><CloudCheck size={22} weight="duotone" aria-hidden="true" /></span>
          <span className="service-status__label">Cierre y predicciones</span>
          <b>Procesamiento asíncrono</b>
          <Badge tone="info">Después del cierre</Badge>
        </Card>
        <Card className="service-status">
          <span className="service-status__icon"><Database size={22} weight="duotone" aria-hidden="true" /></span>
          <span className="service-status__label">Base de datos</span>
          <b>PostgreSQL</b>
          <Badge tone="neutral">Consultar en infraestructura</Badge>
        </Card>
      </div>

      {!loading && !health && !error ? (
        <Card>
          <EmptyState icon={Pulse} title="Sin datos de monitoreo" description="El servicio de salud no devolvió información." />
        </Card>
      ) : null}
    </div>
  );
}
