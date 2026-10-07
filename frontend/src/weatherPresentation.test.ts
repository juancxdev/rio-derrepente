import { describe, expect, it } from 'vitest';
import { weatherLabel, weatherScene } from './weatherPresentation';

describe('weather presentation', () => {
  it('maps every Open-Meteo WMO family to a readable label and visual scene', () => {
    expect(weatherLabel(2)).toBe('Parcialmente nublado');
    expect(weatherLabel(45)).toBe('Niebla');
    expect(weatherLabel(67)).toBe('Lluvia helada');
    expect(weatherLabel(77)).toBe('Granos de nieve');
    expect(weatherLabel(81)).toBe('Chubascos');
    expect(weatherLabel(99)).toBe('Tormenta');
    expect(weatherScene(2)).toBe('partly-cloudy');
    expect(weatherScene(45)).toBe('fog');
    expect(weatherScene(53)).toBe('drizzle');
    expect(weatherScene(63)).toBe('rain');
    expect(weatherScene(81)).toBe('showers');
    expect(weatherScene(85)).toBe('snow');
    expect(weatherScene(96)).toBe('storm');
  });
});
