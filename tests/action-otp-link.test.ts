import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/firestore', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/services/firestore')>()),
  createActionOtpChallenge: vi.fn(async () => ({ ok: true, data: { id: 'c1' } })),
}));
vi.mock('../src/services/write-audit', () => ({ auditWrite: vi.fn(), commandPrefixForAudit: () => 'QUOTE ADD' }));

import { actionOtpHandlers } from '../src/line/handlers/action-otp';
import type { CommandReplyContext } from '../src/line/command-router';

describe('ACTION VERIFY link', () => {
  it('puts /verify/action under the PUBLIC_BASE_URL site path', async () => {
    const previous = process.env.PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = 'https://amardhaka.io/cloudnex-connect';
    try {
      const gate = actionOtpHandlers[0];
      const ctx = {
        text: 'QUOTE ADD 5 3 2',
        userId: 'Uabc',
        userLanguage: 'en',
        profile: { odooVerified: true, role: 'user', salesTier: 'salesperson' },
        agentName: 'Sora',
        baseUrl: 'https://ignored.example',
        channel: { channelId: 'sales', enabledServices: null },
      } as unknown as CommandReplyContext;
      const reply = JSON.stringify(await gate.handle(ctx));
      expect(reply).toContain('https://amardhaka.io/cloudnex-connect/verify/action?token=');
    } finally {
      process.env.PUBLIC_BASE_URL = previous;
    }
  });
});
