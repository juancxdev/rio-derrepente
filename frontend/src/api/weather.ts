import type { WeatherResponse } from '../types';
import { siteID } from './predictions';

export async function getWeatherForecast(days = 7): Promise<WeatherResponse> {
  const response = await fetch(`/api/v1/sites/${siteID}/weather/forecast?days=${days}`);
  if (!response.ok) throw new Error('No pudimos obtener el pronóstico meteorológico.');
  return response.json() as Promise<WeatherResponse>;
}
