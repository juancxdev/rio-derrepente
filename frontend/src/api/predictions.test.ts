import { describe, expect, it, vi } from 'vitest';
import { getPrediction } from './predictions';

describe('getPrediction', () => {
  it('returns null when the prediction does not exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(getPrediction('2026-10-07')).resolves.toBeNull();
  });

  it('returns a typed prediction from a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ estimated_visitors: 24, level: 'MEDIA' }), { status: 200 })));
    await expect(getPrediction('2026-10-07')).resolves.toMatchObject({ estimated_visitors: 24, level: 'MEDIA' });
  });
});
