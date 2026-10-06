import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

afterEach(() => {
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
