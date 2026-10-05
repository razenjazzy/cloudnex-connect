import { describe, expect, it } from 'vitest';
import { saveQuoteInvite, takeQuoteInvitesForPhone } from '../src/line/quote-notify';

describe('quote invites', () => {
  it('stores an invite by phone variants and consumes it once', async () => {
    await saveQuoteInvite('0812345678', 51, 'default');
    const first = await takeQuoteInvitesForPhone('+66812345678');
    expect(first).toEqual([{ orderId: 51, channelId: 'default' }]);
    expect(await takeQuoteInvitesForPhone('0812345678')).toEqual([]);
    await saveQuoteInvite('01787671962', 52, 'default');
    expect(await takeQuoteInvitesForPhone('+8801787671962')).toEqual([{ orderId: 52, channelId: 'default' }]);
    expect(await takeQuoteInvitesForPhone('01787671962')).toEqual([]);
  });
});
