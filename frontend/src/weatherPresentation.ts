import type { Prediction, WeatherForecast } from './types';

function datePart(value: string): string {
  return value.slice(0, 10);
}

export function weatherLabel(code: number | undefined): string {
  if (code === undefined) return 'Sin datos climáticos';
  if (code <= 1) return 'Despejado';
  if (code <= 3) return 'Nublado';
  if (code <= 57) return 'Llovizna';
  if (code <= 82) return 'Lluvia';
  if (code <= 86) return 'Nieve';
  return 'Tormenta';
}

export function attachForecastContext(
  prediction: Prediction | null | undefined,
  days: WeatherForecast[],
): Prediction | null | undefined {
  if (!prediction) return prediction;

  const forecast = days.find((day) => day.date === datePart(prediction.prediction_date));
  if (!forecast) return prediction;

  return {
    ...prediction,
    temperature_max: prediction.temperature_max ?? forecast.temperature_max,
    precipitation_probability: prediction.precipitation_probability ?? forecast.precipitation_probability,
    precipitation_mm: prediction.precipitation_mm ?? forecast.precipitation_mm,
    weather_code: prediction.weather_code ?? forecast.weather_code,
  };
}
