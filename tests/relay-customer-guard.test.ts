import { describe, expect, it } from 'vitest';
import { relayHandlers } from '../src/line/handlers/relay';
import type { CommandReplyContext } from '../src/line/command-router';

const ctxFor = (text: string, channelId: string): CommandReplyContext => ({
  text,
  userId: 'Uadmin',
  userLanguage: 'en',
  // Even a profile that would pass the admin chain must be refused on the Customer OA.
  profile: { role: 'admin', odooVerified: true } as never,
  agentName: 'Sora',
  baseUrl: 'https://x.example',
  channel: { channelId, enabledServices: null },
});

describe('staff relay commands on the Customer OA', () => {
  it.each(['QUOTE ASSIGN 12', 'RELAY ASSIGN U1 5', 'RELAY TO U1', 'STAFF PICK U1'])('%s is refused', async (text) => {
    const handler = relayHandlers.find(h => h.match(text.toUpperCase()));
    expect(handler).toBeDefined();
    const reply = await handler!.handle(ctxFor(text, 'customer'));
    expect(JSON.stringify(reply)).toContain('administrators only');
  });
});
