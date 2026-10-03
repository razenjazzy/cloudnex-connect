import { createHmac } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { handleWebhook } from '../src/line/webhook';

vi.mock('../src/line/channels', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/line/channels')>()),
  resolveChannelConfig: (id: string) => (id === 'sales'
    ? { channelId: 'sales', channelSecret: 'right-secret', channelAccessToken: 'tok', enabledServices: null }
    : null),
}));

const run = async (signature: string) => {
  const body = Buffer.from(JSON.stringify({ events: [] }));
  const req = { params: { channelId: 'sales' }, headers: { 'x-line-signature': signature, 'content-type': 'application/json' }, body, get: () => undefined } as never;
  let finish: () => void = () => undefined;
  const res = { locals: {}, statusCode: 0, status(code: number) { this.statusCode = code; return this; }, json(payload: unknown) { this.payload = payload; finish(); return this; }, send() { finish(); return this; }, getHeader: () => undefined } as unknown as { statusCode: number; payload?: unknown; locals: Record<string, unknown> };
  const [resolve, verify] = handleWebhook as unknown as Array<(...args: unknown[]) => unknown>;
  await new Promise<void>(done => {
    finish = done;
    resolve(req, res, () => verify(req, res, () => done()));
  });
  return res;
};

describe('webhook signature failures', () => {
  it('returns 401 (not 500) when the signature does not match the channel secret', async () => {
    const res = await run('bad-signature');
    expect(res.statusCode).toBe(401);
  });

  it('accepts a signature made with the channel secret', async () => {
    const good = createHmac('sha256', 'right-secret').update(JSON.stringify({ events: [] })).digest('base64');
    const res = await run(good);
    expect(res.statusCode).toBe(0);
  });
});
