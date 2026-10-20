import { ClockCounterClockwise } from '@phosphor-icons/react';
import { HistoryImport } from '../components/HistoryImport';
import { Badge, PageHeader } from '../design-system';
import { useTenant } from '../tenant/TenantContext';

export function HistoryView() {
  const { tenant, activeSite, canManage } = useTenant();

  if (!tenant || !activeSite) {
    return (
      <PageHeader
        eyebrow="Datos operativos"
        title="Histórico"
        description="Selecciona un destino para importar su histórico."
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Datos operativos"
        title="Histórico"
        description={`Importa la afluencia histórica de ${activeSite.name}. La operación solo modifica días sin cierre automático.`}
        actions={<Badge tone={canManage ? 'accent' : 'neutral'}>{canManage ? 'Puedes importar' : 'Solo lectura'}</Badge>}
      />
      <div className="view-note">
        <ClockCounterClockwise size={20} weight="duotone" aria-hidden="true" />
        <p>Los tickets emitidos por la consola son la fuente diaria. La importación CSV se usa para completar el historial previo del destino.</p>
      </div>
      <HistoryImport
        tenantID={tenant.id}
        siteID={activeSite.id}
        destinationName={activeSite.name}
        canManage={canManage}
      />
    </>
  );
}
