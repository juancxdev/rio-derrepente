import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { setAuthToken } from '../api/client';

const platformTenantID = 'aaaaaaaa-0000-0000-0000-000000000001';

const superSession = {
  access_token: 'super-token',
  user: { id: 'super-1', email: 'superadmin@example.com', display_name: 'Super administrador', active: true, is_super_admin: true },
  tenant: { id: '00000000-0000-0000-0000-000000000000', name: 'Plataforma', role: 'super_admin' },
  sites: [],
  closure_hour: 18,
};

const tenant = { id: platformTenantID, name: 'Operador inicial', sites: 1, accounts: 1 };
const newTenant = { id: 'bbbbbbbb-0000-0000-0000-000000000002', name: 'Nuevo operador', sites: 0, accounts: 0 };
const account = { user_id: 'super-1', email: 'superadmin@example.com', display_name: 'Super administrador', active: true, is_super_admin: true };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function installPlatformApi() {
  let createdTenant = false;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.endsWith('/api/v1/auth/login')) return json(superSession);
    if (url.endsWith('/api/v1/auth/logout')) return new Response(null, { status: 204 });
    if (url.endsWith('/api/v1/admin/tenants') && method === 'GET') {
      return json(createdTenant ? [tenant, newTenant] : [tenant]);
    }
    if (url.endsWith('/api/v1/admin/tenants') && method === 'POST') {
      createdTenant = true;
      return json({ id: newTenant.id, name: newTenant.name }, 201);
    }
    if (url.endsWith('/api/v1/admin/users') && method === 'GET') return json([account]);
    if (url.endsWith('/api/v1/admin/users') && method === 'POST') {
      return json({ user_id: 'admin-1', email: 'admin@operador.com', display_name: 'Admin', active: true, is_super_admin: false, tenant_id: platformTenantID, tenant_name: tenant.name, role: 'admin' }, 201);
    }
    if (url.endsWith('/sites') && method === 'GET') return json([]);
    if (url.endsWith('/sites') && method === 'POST') {
      return json({ id: 'cccccccc-0000-0000-0000-000000000003', tenant_id: platformTenantID, code: 'nuevo', name: 'Nuevo destino', latitude: -9.3, longitude: -75.9, timezone: 'America/Lima' }, 201);
    }
    return json({}, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function signInAsSuperAdmin() {
  fireEvent.change(screen.getByLabelText(/Correo electrónico/), { target: { value: 'superadmin@example.com' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-de-prueba' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar a la consola' }));
  await screen.findByRole('heading', { name: 'Operadores' });
  await screen.findByText('Operador inicial');
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setAuthToken(null);
  window.history.replaceState(null, '', '#summary');
});

describe('platform console', () => {
  it('routes a super administrator to the platform console instead of a tenant workspace', async () => {
    installPlatformApi();
    render(<App />);
    await signInAsSuperAdmin();

    expect(screen.getAllByText('Super administrador').length).toBeGreaterThan(0);
    expect(screen.queryByRole('combobox', { name: 'Destino activo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Operadores' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText('Operador inicial')).toBeTruthy();
  });

  it('collapses and expands the platform sidebar', async () => {
    installPlatformApi();
    const { container } = render(<App />);
    await signInAsSuperAdmin();

    const shell = container.querySelector('.app-shell')!;
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar menú lateral' }));
    expect(shell.classList.contains('sidebar-collapsed')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar menú lateral' }));
    expect(shell.classList.contains('sidebar-collapsed')).toBe(false);
  });

  it('creates an operator and then a tenant account', async () => {
    installPlatformApi();
    render(<App />);
    await signInAsSuperAdmin();

    fireEvent.change(screen.getByLabelText(/Nombre del operador/), { target: { value: 'Nuevo operador' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear operador' }));

    expect(await screen.findByText(/Operador Nuevo operador creado/)).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Destinos' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cuentas' }));
    await screen.findByRole('heading', { name: 'Cuentas' });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/), { target: { value: 'admin@operador.com' } });
    fireEvent.change(screen.getByLabelText(/Nombre visible/), { target: { value: 'Admin' } });
    fireEvent.change(screen.getByLabelText(/Contraseña inicial/), { target: { value: 'clave-segura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText(/Cuenta admin@operador.com creada/)).toBeTruthy();
  });

  it('creates a destination for the selected operator', async () => {
    installPlatformApi();
    render(<App />);
    await signInAsSuperAdmin();

    fireEvent.click(screen.getByRole('button', { name: 'Destinos' }));
    await screen.findByRole('heading', { name: 'Destinos' });
    await screen.findByLabelText('Operador');
    await waitFor(() => expect((screen.getByLabelText('Operador') as HTMLSelectElement).value).toBe(platformTenantID));

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Nuevo destino' } });
    fireEvent.change(screen.getByLabelText(/^Código/), { target: { value: 'nuevo' } });
    fireEvent.change(screen.getByLabelText(/^Latitud/), { target: { value: '-9.3' } });
    fireEvent.change(screen.getByLabelText(/^Longitud/), { target: { value: '-75.9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear destino' }));

    expect(await screen.findByText(/Nuevo destino quedó creado/)).toBeTruthy();
  });
});
