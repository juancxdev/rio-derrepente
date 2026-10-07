import { useEffect, useState } from 'react';
import { getHealth, type HealthStatus } from '../api/health';

export function MonitoringPanel() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState(false);

  async function refresh() {
    setError(false);
    try { setHealth(await getHealth()); } catch { setError(true); }
  }

  useEffect(() => { void refresh(); }, []);

  return <section className="monitoring-panel" aria-labelledby="monitoring-title">
    <div className="section-heading"><div><h2 id="monitoring-title">Monitoreo del sistema</h2><p>Estado disponible desde los servicios desplegados. Los registros detallados se revisan en la infraestructura.</p></div><button className="secondary-button" onClick={refresh}>Actualizar estado</button></div>
    <div className="service-status-grid">
      <article className="service-status"><span>API principal</span><b>{health?.service ?? 'Comprobando'}</b><p className={error ? 'status-error' : 'status-ok'}>{error ? 'Sin respuesta' : health ? 'Operativa' : 'Consultando estado'}</p></article>
      <article className="service-status"><span>Eventos y predicciones</span><b>Procesamiento asíncrono</b><p>Se activa después del cierre diario.</p></article>
      <article className="service-status"><span>Registro técnico</span><b>Infraestructura</b><p>Los logs se consultan desde Docker o CloudWatch.</p></article>
    </div>
  </section>;
}
