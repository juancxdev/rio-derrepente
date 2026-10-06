import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PredictionCard } from './PredictionCard';

describe('PredictionCard', () => {
  it('explains the absence of a prediction without inventing numbers', () => {
    render(<PredictionCard title="Hoy" data={null} loading={false} />);
    expect(screen.getByText('Aún no disponible')).toBeTruthy();
    expect(screen.queryByText('posibles consumidores')).toBeNull();
  });

  it('shows a persisted prediction and its weather', () => {
    render(<PredictionCard title="Mañana" loading={false} data={{ prediction_date: '2026-10-07', estimated_visitors: 38, score: 71, level: 'ALTA', model_version: 'baseline-1.0', temperature_max: 31, precipitation_probability: 30 }} />);
    expect(screen.getByText('38')).toBeTruthy();
    expect(screen.getByText(/Máxima: 31/)).toBeTruthy();
  });
});
