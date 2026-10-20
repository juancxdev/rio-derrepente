import type { Prediction } from '../types';
import { apiFetch } from './client';

export async function getPrediction(tenantID: string, siteID: string, date: string): Promise<Prediction | null> {
  const response = await apiFetch(`/api/v1/tenants/${tenantID}/sites/${siteID}/predictions/${date}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('No pudimos conectar con el servicio de predicciones.');
  return response.json() as Promise<Prediction>;
}
