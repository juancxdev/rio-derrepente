import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('App', () => {
  it('shows a friendly retry state when the API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
    render(<App />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('does not request or show tomorrow before the 18:00 daily close', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T15:00:00Z'));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ estimated_visitors: 21, score: 50, level: 'MEDIA', prediction_date: '2026-10-06' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ source: 'open-meteo', days: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText('Se habilita después del cierre')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/predictions/2026-10-07'))).toBe(false);
  });

  it('completes the main prediction climate context from the backend forecast', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T15:00:00Z'));
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ estimated_visitors: 31, score: 72, level: 'ALTA', prediction_date: '2026-10-07', model_version: 'baseline-1.0' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ source: 'open-meteo', days: [{ date: '2026-10-07', temperature_max: 32, precipitation_mm: 2, precipitation_probability: 25, weather_code: 61 }] }), { status: 200 })));
    render(<App />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getAllByText('32 °C').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText('2.0 mm').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Lluvia').length).toBeGreaterThan(0);
  });

  it('shows tomorrow after the current daily visit was registered and its prediction is persisted', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T23:10:00Z'));
    window.localStorage.setItem('rio-derrepente:registered-visit-date', '2026-10-06');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ estimated_visitors: 21, score: 50, level: 'MEDIA', prediction_date: '2026-10-06' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ source: 'open-meteo', days: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ estimated_visitors: 38, score: 76, level: 'ALTA', prediction_date: '2026-10-07' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText('38')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/predictions/2026-10-07'))).toBe(true);
  });
});
