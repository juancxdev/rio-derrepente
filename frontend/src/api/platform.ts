import type { PlatformAccount, PlatformTenant, Role, Site } from '../types';
import { apiJSON } from './client';
import type { CreateSiteInput } from './ticketing';

export async function listPlatformTenants(): Promise<PlatformTenant[]> {
  return apiJSON<PlatformTenant[]>('/api/v1/admin/tenants');
}

export async function createPlatformTenant(name: string): Promise<Pick<PlatformTenant, 'id' | 'name'>> {
  return apiJSON<Pick<PlatformTenant, 'id' | 'name'>>('/api/v1/admin/tenants', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function listPlatformSites(tenantID: string): Promise<Site[]> {
  return apiJSON<Site[]>(`/api/v1/admin/tenants/${tenantID}/sites`);
}

export async function createPlatformSite(tenantID: string, input: CreateSiteInput): Promise<Site> {
  return apiJSON<Site>(`/api/v1/admin/tenants/${tenantID}/sites`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listPlatformAccounts(): Promise<PlatformAccount[]> {
  return apiJSON<PlatformAccount[]>('/api/v1/admin/users');
}

export type CreateAccountInput = {
  email: string;
  display_name: string;
  password: string;
  tenant_id: string;
  role: Exclude<Role, 'super_admin'>;
};

export async function createPlatformAccount(input: CreateAccountInput): Promise<PlatformAccount> {
  return apiJSON<PlatformAccount>('/api/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
