import type { ClosureStatus, SaleResult, Site } from '../types';
import { apiJSON } from './client';

export async function listSites(tenantID: string): Promise<Site[]> {
  return apiJSON<Site[]>(`/api/v1/tenants/${tenantID}/sites`);
}

export type CreateSiteInput = Omit<Site, 'id' | 'tenant_id'>;

export async function createSite(tenantID: string, input: CreateSiteInput): Promise<Site> {
  return apiJSON<Site>(`/api/v1/tenants/${tenantID}/sites`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function sellTickets(tenantID: string, siteID: string, quantity: number, idempotencyKey: string): Promise<SaleResult> {
  return apiJSON<SaleResult>(`/api/v1/tenants/${tenantID}/sites/${siteID}/tickets`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ quantity }),
  });
}

export async function importHistory(tenantID: string, siteID: string, file: File): Promise<number> {
  const result = await apiJSON<{ imported_rows: number }>(`/api/v1/tenants/${tenantID}/sites/${siteID}/imports?source=operator_csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv' },
    body: file,
  });
  return result.imported_rows;
}

export async function getClosureStatus(tenantID: string, siteID: string, date: string): Promise<ClosureStatus> {
  return apiJSON<ClosureStatus>(`/api/v1/tenants/${tenantID}/sites/${siteID}/closures/${date}`);
}
