import { afterEach, describe, expect, it, vi } from 'vitest';
import { listLineChannelIds, lineChannelKeys } from '../src/line/channels';
import { normalizeBasicId, verifyLineChannelToken } from '../src/line/channel-verify';

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('verifyLineChannelToken', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the OA identity and webhook for a valid token', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { displayName: 'Cloudnex Sales', basicId: '@938qytwi' }))
      .mockResolvedValueOnce(jsonResponse(200, { endpoint: 'https://x.example/webhook/sales', active: true }));
    const result = await verifyLineChannelToken('tok');
    expect(result).toMatchObject({ ok: true, basicId: '@938qytwi', webhookActive: true });
  });

  it('reports LINE rejecting the token without leaking it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(401, { message: 'Authentication failed.' }));
    const result = await verifyLineChannelToken('secret-token-value');
    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(JSON.stringify(result)).not.toContain('secret-token-value');
  });

  it('flags an unreachable LINE (status 0) so callers do not treat it as a bad token', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'));
    expect(await verifyLineChannelToken('tok')).toMatchObject({ ok: false, status: 0 });
  });

  it('normalizes Basic IDs for comparison', () => {
    expect(normalizeBasicId('@938QYTWI ')).toBe(normalizeBasicId('938qytwi'));
  });
});

describe('line channel keys', () => {
  it('maps default to the flat names and others to LINE_CHANNEL_<ID>_*', () => {
    expect(lineChannelKeys('default').token).toBe('LINE_CHANNEL_ACCESS_TOKEN');
    expect(lineChannelKeys('sales')).toMatchObject({ secret: 'LINE_CHANNEL_SALES_SECRET', basicId: 'LINE_CHANNEL_SALES_BASIC_ID' });
  });

  it('always lists default, sales and customer', () => {
    expect(listLineChannelIds()).toEqual(expect.arrayContaining(['default', 'sales', 'customer']));
  });
});
