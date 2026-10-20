import { CheckCircle, Minus, Plus, Ticket } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { ApiError, errorMessage } from '../api/client';
import { sellTickets } from '../api/ticketing';
import { Alert, Button, Card, Field, Input } from '../design-system';
import { dateInZone } from '../time';
import type { Role, SaleEntry, Site } from '../types';

type Props = {
  tenantID: string;
  site: Site;
  role: Role;
  onSold: (entry: SaleEntry) => void;
};

type SaleError = { title: string; message: string };

function saleErrorMessage(error: unknown): SaleError {
  if (error instanceof ApiError) {
    switch (true) {
      case error.status === 400 || error.status === 422:
        return { title: 'Revisa la cantidad', message: error.message };
      case error.status === 401:
        return { title: 'Sesión vencida', message: 'Tu sesión expiró. Inicia sesión nuevamente para emitir tickets.' };
      case error.status === 403:
        return { title: 'Sin permiso para vender', message: 'Tu rol no permite emitir tickets en este tenant.' };
      case error.status === 404:
        return { title: 'Destino no disponible', message: 'El destino no pertenece al tenant autenticado o fue retirado.' };
      case error.status === 409:
        return { title: 'Cierre en curso', message: 'El cierre del día ya comenzó. No se pueden emitir más tickets para hoy.' };
      case error.status >= 500:
        return { title: 'No pudimos confirmar la venta', message: 'El servicio no respondió. Revisa el historial antes de reintentar; la venta no se repite automáticamente.' };
      default:
        return { title: 'No se pudo emitir la venta', message: error.message };
    }
  }
  return { title: 'No pudimos confirmar la venta', message: errorMessage(error, 'Revisa tu conexión y vuelve a intentarlo. La venta no se repite automáticamente.') };
}

function newKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function TicketSaleForm({ tenantID, site, role, onSold }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<SaleError | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<SaleEntry | null>(null);
  const localDate = dateInZone(new Date(), site.timezone);

  function updateQuantity(next: number) {
    setValidation(null);
    setQuantity(Number.isFinite(next) ? Math.min(100, Math.max(1, Math.trunc(next))) : 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setValidation(null);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      setValidation('La cantidad debe ser un número entero entre 1 y 100.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await sellTickets(tenantID, site.id, quantity, newKey());
      const entry: SaleEntry = {
        id: newKey(),
        issuedFor: result.issued_for || localDate,
        quantity: result.quantity,
        codes: result.codes,
        status: 'success',
        createdAt: new Date().toISOString(),
      };
      setLastSale(entry);
      onSold(entry);
      setQuantity(1);
    } catch (requestError) {
      setError(saleErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || role === null;

  return (
    <Card className="sale-card">
      <div className="section-heading">
        <div>
          <h2>Venta presencial</h2>
          <p>Cada ticket emitido cuenta como una visita real del {localDate} en {site.name}.</p>
        </div>
        <span className="status-pill">1 a 100 tickets</span>
      </div>

      <form className="sale-form" onSubmit={submit} noValidate>
        <Field
          label="Cantidad de tickets"
          htmlFor="sale-quantity"
          hint="Se registran en la fecha local del destino."
          error={validation}
        >
          <div className="quantity-control">
            <button type="button" aria-label="Restar un ticket" onClick={() => updateQuantity(quantity - 1)} disabled={disabled || quantity <= 1}>
              <Minus size={18} weight="bold" aria-hidden="true" />
            </button>
            <Input
              id="sale-quantity"
              name="quantity"
              type="number"
              min={1}
              max={100}
              step={1}
              value={quantity}
              invalid={Boolean(validation)}
              onChange={(event) => updateQuantity(Number(event.target.value))}
            />
            <button type="button" aria-label="Sumar un ticket" onClick={() => updateQuantity(quantity + 1)} disabled={disabled || quantity >= 100}>
              <Plus size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </Field>

        <div className="sale-summary">
          <span>Total a emitir</span>
          <strong>{quantity} {quantity === 1 ? 'ticket' : 'tickets'}</strong>
          <small>{site.timezone}</small>
        </div>

        <Button type="submit" icon={Ticket} loading={submitting} disabled={disabled} block>
          {submitting ? 'Emitiendo tickets' : 'Emitir tickets'}
        </Button>
      </form>

      {error ? <Alert tone="danger" title={error.title}>{error.message}</Alert> : null}

      {lastSale ? (
        <div className="sale-result" role="status" aria-live="polite">
          <p className="sale-result__head"><CheckCircle size={20} weight="fill" aria-hidden="true" /> {lastSale.quantity} {lastSale.quantity === 1 ? 'ticket emitido' : 'tickets emitidos'}</p>
          <p className="sale-result__meta">Fecha de emisión: {lastSale.issuedFor}</p>
          <ul className="code-list" aria-label="Códigos emitidos">
            {lastSale.codes.map((code) => <li key={code}><code>{code}</code></li>)}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
