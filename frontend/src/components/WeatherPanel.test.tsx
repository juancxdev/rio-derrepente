import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeatherPanel } from './WeatherPanel';

describe('WeatherPanel', () => {
  it('shows a visual weather overview with rainfall probability and millimetres', () => {
    render(<WeatherPanel days={[{ date: '2026-10-07', temperature_max: 28, precipitation_mm: 3.2, precipitation_probability: 91, weather_code: 80, observed: false }]} />);
    expect(screen.getByRole('heading', { name: 'Pronóstico del clima' })).toBeTruthy();
    expect(screen.getByText('91% · 3.2 mm')).toBeTruthy();
    expect(screen.getByText('Chubascos')).toBeTruthy();
    expect(screen.getByLabelText('Clima de la semana en curso')).toBeTruthy();
  });

  it('labels completed days as observed instead of inventing a rainfall probability', () => {
    render(<WeatherPanel days={[{ date: '2026-10-05', temperature_max: 29, precipitation_mm: 1.4, precipitation_probability: null, weather_code: 51, observed: true }]} />);
    expect(screen.getByText('Observado · 1.4 mm')).toBeTruthy();
  });
});
