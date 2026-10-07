import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PredictionCard } from './PredictionCard';

describe('PredictionCard', () => {
  it('explains the absence of a prediction without inventing numbers', () => {
    render(<PredictionCard title="Hoy" data={null} loading={false} />);
    expect(screen.getByText('Aún no disponible')).toBeTruthy();
    expect(screen.queryByText('posibles consumidores')).toBeNull();
  });

  it('shows the demand estimate without repeating weather details', () => {
    render(<PredictionCard title="Mañana" loading={false} data={{ prediction_date: '2026-10-07', estimated_visitors: 38, score: 71, level: 'ALTA', model_version: 'baseline-1.0', temperature_max: 31, precipitation_probability: 30, precipitation_mm: 1.2, weather_code: 3 }} />);
    expect(screen.getAllByText('38').length).toBeGreaterThan(0);
    expect(screen.getByText('Prepara mayor stock y personal para atender la demanda.')).toBeTruthy();
    expect(screen.queryByText('Temperatura máxima')).toBeNull();
    expect(screen.queryByText('Probabilidad de lluvia')).toBeNull();
  });

  it('does not depend on weather context to explain the demand estimate', () => {
    render(<PredictionCard title="Hoy" loading={false} data={{ prediction_date: '2026-10-07', estimated_visitors: 38, score: 71, level: 'ALTA', model_version: 'baseline-1.0' }} />);
    expect(screen.getAllByText('38').length).toBeGreaterThan(0);
    expect(screen.queryByText('El contexto climático para esta fecha aún no está disponible.')).toBeNull();
  });
});
