import { MapPin } from '@phosphor-icons/react';
import { useTenant } from '../tenant/TenantContext';

export function TenantSwitcher() {
  const { tenant, sites, activeSiteID, selectSite } = useTenant();
  return (
    <div className="tenant-switcher">
      <p className="tenant-switcher__label">Operador</p>
      <p className="tenant-switcher__name">{tenant?.name ?? 'Sin tenant'}</p>
      <label className="sr-only" htmlFor="active-site">Destino activo</label>
      <div className="tenant-switcher__select">
        <MapPin size={16} weight="duotone" aria-hidden="true" />
        <select
          id="active-site"
          value={activeSiteID ?? ''}
          onChange={(event) => selectSite(event.target.value)}
          disabled={sites.length === 0}
        >
          {sites.length === 0 ? <option value="">Sin destinos disponibles</option> : null}
          {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
        </select>
      </div>
      <p className="tenant-switcher__meta">{sites.length} {sites.length === 1 ? 'destino habilitado' : 'destinos habilitados'}</p>
    </div>
  );
}
