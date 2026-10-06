import type { Prediction } from '../types';

export const siteID = '11111111-1111-1111-1111-111111111111';

export async function getPrediction(date: string): Promise<Prediction | null> {
  const response = await fetch(`/api/v1/sites/${siteID}/predictions/${date}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('No pudimos conectar con el servicio.');
  return response.json() as Promise<Prediction>;
}
