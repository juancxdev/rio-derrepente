import { Receipt } from '@phosphor-icons/react';
import { Badge, Card, DataTable, EmptyState } from '../design-system';
import type { SaleEntry } from '../types';

export function TicketSaleHistory({ entries }: { entries: SaleEntry[] }) {
  return (
    <Card className="sale-history-card">
      <div className="section-heading">
        <div>
          <h2>Últimos resultados</h2>
          <p>Ventas emitidas en esta sesión. La fuente oficial de afluencia vive en PostgreSQL.</p>
        </div>
        <Badge tone="neutral">{entries.length} en sesión</Badge>
      </div>
      <DataTable
        caption="Ventas emitidas en esta sesión"
        columns={[
          { key: 'issuedFor', header: 'Fecha', render: (entry) => entry.issuedFor },
          { key: 'quantity', header: 'Cantidad', align: 'end', render: (entry) => `${entry.quantity}` },
          {
            key: 'codes',
            header: 'Códigos',
            render: (entry) => <span className="code-list code-list--inline">{entry.codes.map((code) => <code key={code}>{code}</code>)}</span>,
          },
          { key: 'status', header: 'Estado', render: () => <Badge tone="success">Emitida</Badge> },
        ]}
        rows={entries}
        rowKey={(entry) => entry.id}
        empty={<EmptyState icon={Receipt} title="Todavía no hay ventas" description="Emite el primer ticket para ver aquí la fecha, la cantidad y sus códigos." />}
      />
    </Card>
  );
}
