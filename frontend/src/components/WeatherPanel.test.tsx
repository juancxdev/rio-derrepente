import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeatherPanel } from './WeatherPanel';

describe('WeatherPanel', () => {
  it('shows an operational weather table with rainfall probability and millimetres', () => {
    render(<WeatherPanel days={[{ date: '2026-10-07', temperature_max: 28, precipitation_mm: 3.2, precipitation_probability: 91, weather_code: 80 }]} />);
    expect(screen.getByRole('columnheader', { name: 'Lluvia' })).toBeTruthy();
    expect(screen.getAllByText('91%')).toHaveLength(2);
    expect(screen.getByText('3.2 mm')).toBeTruthy();
    expect(screen.getByText('🌦️ Lluvia')).toBeTruthy();
    expect(screen.getAllByText('Precaución: evalúa el sendero y el río.')).toHaveLength(2);
  });
});
