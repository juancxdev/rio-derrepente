import { MapPin } from '@phosphor-icons/react';
import { DestinationManagement } from '../components/DestinationManagement';
import { EmptyState, PageHeader } from '../design-system';
import { useTenant } from '../tenant/TenantContext';

export function DestinationsView() {
  const { tenant, sites, activeSiteID, canManage, addSite, selectSite } = useTenant();

  if (!tenant) {
    return (
      <EmptyState
        icon={MapPin}
        title="Sin tenant asignado"
        description="La cuenta no tiene un operador turístico asociado. Pide acceso a un administrador."
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuración"
        title="Destinos"
        description="Consulta los destinos del tenant y crea uno nuevo cuando la operación lo requiera."
      />
      <DestinationManagement
        tenantID={tenant.id}
        sites={sites}
        activeSiteID={activeSiteID}
        canManage={canManage}
        onCreated={addSite}
        onSelect={selectSite}
      />
    </>
  );
}
