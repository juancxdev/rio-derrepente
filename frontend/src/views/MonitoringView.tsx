import { MonitoringPanel } from '../components/MonitoringPanel';
import { PageHeader } from '../design-system';

export function MonitoringView() {
  return (
    <>
      <PageHeader
        eyebrow="Operación técnica"
        title="Monitoreo"
        description="Comprueba la disponibilidad de los servicios que sostienen la venta, el cierre y las predicciones."
      />
      <MonitoringPanel />
    </>
  );
}
