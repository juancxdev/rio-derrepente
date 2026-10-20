import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPrediction } from './predictions';

const tenantID = '00000000-0000-0000-0000-000000000001';
const siteID = '11111111-1111-1111-1111-111111111111';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getPrediction', () => {
  it('returns null when the prediction does not exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(getPrediction(tenantID, siteID, '2026-10-07')).resolves.toBeNull();
  });

  it('requests the tenant-scoped prediction and returns typed data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ estimated_visitors: 24, level: 'MEDIA' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getPrediction(tenantID, siteID, '2026-10-07')).resolves.toMatchObject({ estimated_visitors: 24, level: 'MEDIA' });
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/v1/tenants/${tenantID}/sites/${siteID}/predictions/2026-10-07`);
  });
});
