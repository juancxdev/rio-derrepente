import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAuthToken } from '../api/client';
import type { Site } from '../types';
import { TicketSaleForm } from './TicketSaleForm';

const site: Site = {
  id: '11111111-1111-1111-1111-111111111111',
  tenant_id: '00000000-0000-0000-0000-000000000001',
  code: 'catarata',
  name: 'Catarata del Río Derrepente',
  latitude: -9.295,
  longitude: -75.996,
  timezone: 'America/Lima',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function renderForm(onSold = vi.fn()) {
  render(<TicketSaleForm tenantID={site.tenant_id} site={site} role="operator" onSold={onSold} />);
  return onSold;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setAuthToken(null);
});

describe('TicketSaleForm', () => {
  it('sends the tenant-scoped request with quantity, idempotency and bearer token', async () => {
    setAuthToken('signed-token');
    const fetchMock = vi.fn().mockResolvedValue(json({ codes: ['TCK-001', 'TCK-002'], quantity: 2, issued_for: '2026-10-20' }, 201));
    vi.stubGlobal('fetch', fetchMock);
    const onSold = renderForm();

    fireEvent.change(screen.getByLabelText('Cantidad de tickets'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Emitir tickets' }));

    expect(await screen.findByText('2 tickets emitidos')).toBeTruthy();
    expect(screen.getByText('TCK-001')).toBeTruthy();
    expect(screen.getByText('TCK-002')).toBeTruthy();
    expect(screen.getByText('Fecha de emisión: 2026-10-20')).toBeTruthy();
    expect(onSold).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2, codes: ['TCK-001', 'TCK-002'] }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/v1/tenants/${site.tenant_id}/sites/${site.id}/tickets`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ quantity: 2 }));
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer signed-token');
    expect(headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('disables the submit button while the request is in flight', async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>((done) => { resolve = done; })));
    renderForm();

    const button = screen.getByRole('button', { name: 'Emitir tickets' }) as HTMLButtonElement;
    fireEvent.click(button);

    await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('true'));
    expect(button.disabled).toBe(true);

    resolve(json({ codes: ['TCK-009'], quantity: 1, issued_for: '2026-10-20' }, 201));
    expect(await screen.findByText('1 ticket emitido')).toBeTruthy();
  });

  it('maps a closure conflict to a clear message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: { code: 'conflict', message: 'La jornada ya cerró.' } }, 409)));
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Emitir tickets' }));

    expect(await screen.findByText('Cierre en curso')).toBeTruthy();
    expect(screen.getByText('El cierre del día ya comenzó. No se pueden emitir más tickets para hoy.')).toBeTruthy();
  });

  it('maps a server failure to a retry without duplicating the sale', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: { code: 'internal_error', message: 'internal server error' } }, 500)));
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Emitir tickets' }));

    expect(await screen.findByText('No pudimos confirmar la venta')).toBeTruthy();
    expect(screen.getByText(/Revisa el historial antes de reintentar/)).toBeTruthy();
  });

  it('shows validation feedback for a 422 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: { code: 'validation_error', message: 'quantity must be between 1 and 100' } }, 422)));
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Emitir tickets' }));

    expect(await screen.findByText('Revisa la cantidad')).toBeTruthy();
    expect(screen.getByText('quantity must be between 1 and 100')).toBeTruthy();
  });
});
