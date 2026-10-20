import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { setAuthToken } from './api/client';
import type { Site } from './types';

const tenantID = '00000000-0000-0000-0000-000000000001';

const siteA: Site = {
  id: '11111111-1111-1111-1111-111111111111',
  tenant_id: tenantID,
  code: 'catarata',
  name: 'Catarata del Río Derrepente',
  latitude: -9.295,
  longitude: -75.996,
  timezone: 'America/Lima',
};

const siteB: Site = {
  id: '22222222-2222-2222-2222-222222222222',
  tenant_id: tenantID,
  code: 'mirador',
  name: 'Mirador del Bosque',
  latitude: -9.31,
  longitude: -75.98,
  timezone: 'America/Lima',
};

const prediction = {
  prediction_date: '2026-10-20',
  estimated_visitors: 31,
  score: 72,
  level: 'ALTA',
  model_version: 'baseline-1.0',
};

const closure = {
  date: '2026-10-20',
  status: 'pending',
  closed: false,
  tickets: 12,
  prediction_available: false,
  event_published_at: null,
  event_error: null,
  closure_hour: 18,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function session(sites: Site[] = [siteA, siteB]) {
  return {
    access_token: 'signed-token',
    user: { id: 'user-1', email: 'operador@example.com', display_name: 'Operador Demo', active: true },
    tenant: { id: tenantID, name: 'Operador turístico', role: 'manager' },
    sites,
    closure_hour: 18,
  };
}

type ApiOptions = {
  sites?: Site[];
  loginStatus?: number;
  ticketsStatus?: number;
  failSummary?: boolean;
  pendingSummary?: boolean;
};

function installApi(options: ApiOptions = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith('/api/v1/auth/login')) {
      if (options.loginStatus) return json({ error: { code: 'invalid_credentials', message: 'Correo o contraseña incorrectos.' } }, options.loginStatus);
      return json(session(options.sites));
    }
    if (url.endsWith('/api/v1/auth/logout')) return new Response(null, { status: 204 });
    if (url.includes('/tickets')) {
      if (options.ticketsStatus) return json({ error: { code: 'conflict', message: 'La jornada ya cerró.' } }, options.ticketsStatus);
      return json({ codes: ['TCK-001', 'TCK-002'], quantity: 2, issued_for: '2026-10-20' }, 201);
    }
    if (options.pendingSummary) {
      return new Promise<Response>(() => undefined);
    }
    if (options.failSummary) {
      throw new Error('network unavailable');
    }
    if (url.includes('/predictions/')) return json(prediction);
    if (url.includes('/weather/forecast')) return json({ source: 'open-meteo', days: [] });
    if (url.includes('/closures/')) return json(closure);
    if (url.includes('/sites')) return json(options.sites ?? [siteA, siteB]);
    return json({}, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function fillLogin() {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'operador@example.com' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-de-prueba' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar a la consola' }));
}

async function signIn() {
  await fillLogin();
  await screen.findByRole('heading', { name: 'Resumen operativo' });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setAuthToken(null);
  window.history.replaceState(null, '', '#summary');
});

describe('authentication gate', () => {
  it('shows neutral platform branding instead of a tenant brand', () => {
    installApi();
    render(<App />);
    expect(screen.getByText('Afluencia')).toBeTruthy();
    expect(screen.queryByText(/Río Derrepente/i)).toBeNull();
    expect(screen.queryByText(/superadmin@example\.com/)).toBeNull();
    expect(screen.getByText(/No hay contraseñas por defecto/)).toBeTruthy();
  });

  it('shows the login page when there is no session', () => {
    installApi();
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Inicia sesión' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).toBeNull();
  });

  it('shows an invalid credentials error without entering the shell', async () => {
    installApi({ loginStatus: 401 });
    render(<App />);
    await fillLogin();
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Inicia sesión' })).toBeTruthy();
  });

  it('hydrates tenant and destinations after a successful login', async () => {
    const fetchMock = installApi();
    const { container } = render(<App />);
    await signIn();

    expect(screen.getByText('Operador turístico')).toBeTruthy();
    const select = screen.getByRole('combobox', { name: 'Destino activo' }) as HTMLSelectElement;
    expect(select.value).toBe(siteA.id);
    const options = within(select).getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual([siteA.name, siteB.name]);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/v1/auth/login')).toBe(true);
    expect(container.querySelector('.app-shell')).toBeTruthy();
  });

  it('logs out from the sidebar and returns to login', async () => {
    installApi();
    render(<App />);
    await signIn();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeTruthy();
  });
});

describe('tenant isolation in the shell', () => {
  it('only renders destinations returned for the authenticated tenant', async () => {
    installApi();
    render(<App />);
    await signIn();
    expect(screen.queryByRole('option', { name: /otro tenant/i })).toBeNull();
    expect(screen.queryByRole('option', { name: /destino ajeno/i })).toBeNull();
  });

  it('reloads the workspace with the newly selected destination', async () => {
    const fetchMock = installApi();
    render(<App />);
    await signIn();
    const callCountBeforeSwitch = fetchMock.mock.calls.length;

    fireEvent.change(screen.getByRole('combobox', { name: 'Destino activo' }), { target: { value: siteB.id } });

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(urls.some((url) => url.includes(`/sites/${siteB.id}/weather/forecast`))).toBe(true);
    });
    const callsAfterSwitch = fetchMock.mock.calls
      .slice(callCountBeforeSwitch)
      .map(([url]) => String(url))
      .filter((url) => url.includes('/sites/'));
    expect(callsAfterSwitch.length).toBeGreaterThan(0);
    expect(callsAfterSwitch.every((url) => url.includes(`/sites/${siteB.id}/`))).toBe(true);
  });
});

describe('navigation shell', () => {
  it('navigates between views and marks the active item', async () => {
    installApi();
    render(<App />);
    await signIn();

    fireEvent.click(screen.getByRole('button', { name: 'Ventas' }));
    expect(await screen.findByRole('heading', { name: 'Ventas' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ventas' }).getAttribute('aria-current')).toBe('page');

    fireEvent.click(screen.getByRole('button', { name: 'Destinos' }));
    expect(await screen.findByRole('heading', { name: 'Destinos' })).toBeTruthy();
    expect(window.location.hash).toBe('#sites');
  });

  it('collapses and expands the desktop sidebar', async () => {
    installApi();
    const { container } = render(<App />);
    await signIn();

    const shell = container.querySelector('.app-shell')!;
    expect(shell.classList.contains('sidebar-collapsed')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar menú lateral' }));
    expect(shell.classList.contains('sidebar-collapsed')).toBe(true);
    expect(screen.getByRole('button', { name: 'Mostrar menú lateral' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar menú lateral' }));
    expect(shell.classList.contains('sidebar-collapsed')).toBe(false);
  });

  it('opens and closes the mobile drawer navigation', async () => {
    installApi();
    const { container } = render(<App />);
    await signIn();

    const shell = container.querySelector('.app-shell')!;
    expect(shell.classList.contains('drawer-open')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir navegación' }));
    expect(shell.classList.contains('drawer-open')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(await screen.findByRole('heading', { name: 'Histórico' })).toBeTruthy();
    expect(shell.classList.contains('drawer-open')).toBe(false);
  });
});

describe('workspace states', () => {
  it('keeps skeletons visible while the summary is loading', async () => {
    installApi({ pendingSummary: true });
    render(<App />);
    await fillLogin();
    expect(await screen.findByText('Cargando predicción…')).toBeTruthy();
  });

  it('shows an empty state when the tenant has no destinations', async () => {
    installApi({ sites: [] });
    render(<App />);
    await fillLogin();
    expect(await screen.findByRole('heading', { name: 'Sin destino activo' })).toBeTruthy();
  });

  it('shows a retryable error when the API is unavailable', async () => {
    installApi({ failSummary: true });
    render(<App />);
    await signIn();
    expect(await screen.findByText('No pudimos actualizar la información')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });
});

describe('ticket sale authorization', () => {
  it('clears the session and returns to login when the sale receives 401', async () => {
    installApi({ ticketsStatus: 401 });
    render(<App />);
    await signIn();

    fireEvent.click(screen.getByRole('button', { name: 'Ventas' }));
    await screen.findByRole('heading', { name: 'Ventas' });
    fireEvent.change(screen.getByLabelText('Cantidad de tickets'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Emitir tickets' }));

    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeTruthy();
    expect(screen.getByText('La sesión venció. Inicia sesión nuevamente para continuar.')).toBeTruthy();
  });
});
