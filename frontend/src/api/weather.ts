import type { WeatherResponse } from '../types';
import { apiFetch } from './client';

export async function getWeatherForecast(tenantID: string, siteID: string, days = 7): Promise<WeatherResponse> {
  const response = await apiFetch(`/api/v1/tenants/${tenantID}/sites/${siteID}/weather/forecast?days=${days}`);
  if (!response.ok) throw new Error('No pudimos obtener el pronóstico meteorológico.');
  return response.json() as Promise<WeatherResponse>;
}
