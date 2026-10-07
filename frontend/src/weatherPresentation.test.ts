import { describe, expect, it } from 'vitest';
import { attachForecastContext } from './weatherPresentation';

const forecast = [{
  date: '2026-10-07',
  temperature_max: 28,
  precipitation_mm: 3.2,
  precipitation_probability: 91,
  weather_code: 80,
}];

describe('attachForecastContext', () => {
  it('uses the backend forecast only for missing weather fields on the matching date', () => {
    expect(attachForecastContext({
      prediction_date: '2026-10-07T00:00:00Z', estimated_visitors: 38, score: 71, level: 'ALTA', model_version: 'baseline-1.0',
    }, forecast)).toMatchObject({ temperature_max: 28, precipitation_mm: 3.2, precipitation_probability: 91, weather_code: 80 });
  });

  it('keeps weather values persisted with the prediction', () => {
    expect(attachForecastContext({
      prediction_date: '2026-10-07', estimated_visitors: 38, score: 71, level: 'ALTA', model_version: 'baseline-1.0', temperature_max: 31, precipitation_probability: 30,
    }, forecast)).toMatchObject({ temperature_max: 31, precipitation_probability: 30, precipitation_mm: 3.2, weather_code: 80 });
  });

  it('does not add climate data when the forecast has no matching date', () => {
    expect(attachForecastContext({
      prediction_date: '2026-10-08', estimated_visitors: 38, score: 71, level: 'ALTA', model_version: 'baseline-1.0',
    }, forecast)).not.toHaveProperty('temperature_max');
  });
});
