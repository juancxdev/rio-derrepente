import { MapPin, ShieldCheck, Ticket } from '@phosphor-icons/react';
import { useState } from 'react';
import { TicketSaleForm } from '../components/TicketSaleForm';
import { TicketSaleHistory } from '../components/TicketSaleHistory';
import { Badge, Card, EmptyState, PageHeader } from '../design-system';
import { useTenant } from '../tenant/TenantContext';
import { dateInZone } from '../time';
import type { SaleEntry } from '../types';

export function SalesView() {
  const { tenant, activeSite, role, closureHour } = useTenant();
  const [entries, setEntries] = useState<SaleEntry[]>([]);

  if (!tenant || !activeSite || !role) {
    return (
      <EmptyState
        icon={MapPin}
        title="Sin destino activo"
        description="Selecciona un destino del tenant para emitir tickets presenciales."
      />
    );
  }

  const localDate = dateInZone(new Date(), activeSite.timezone);

  return (
    <>
      <PageHeader
        eyebrow="Operación diaria"
        title="Ventas"
        description={`Emite tickets para ${activeSite.name}. La fecha operativa es ${localDate} en ${activeSite.timezone}.`}
        actions={<Badge tone="accent">{activeSite.code}</Badge>}
      />

      <div className="sales-layout">
        <TicketSaleForm
          tenantID={tenant.id}
          site={activeSite}
          role={role}
          onSold={(entry) => setEntries((current) => [entry, ...current])}
        />

        <Card className="sales-context">
          <div className="section-heading">
            <div>
              <h2>Control de la venta</h2>
              <p>La venta queda ligada al tenant y al destino del token, no a un identificador escrito en el navegador.</p>
            </div>
          </div>
          <ul className="guide-list">
            <li><Ticket size={18} weight="duotone" aria-hidden="true" /> Cada ticket cuenta como una visita real del día local del destino.</li>
            <li><ShieldCheck size={18} weight="duotone" aria-hidden="true" /> La petición viaja con el token firmado y una clave de idempotencia para evitar duplicados.</li>
            <li><MapPin size={18} weight="duotone" aria-hidden="true" /> Si el destino no pertenece al tenant, la API responde como no encontrado.</li>
          </ul>
          <p className="summary-note__meta">Cierre automático configurado para las {closureHour}:00 hora local del destino.</p>
        </Card>
      </div>

      <TicketSaleHistory entries={entries} />
    </>
  );
}
