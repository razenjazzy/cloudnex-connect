import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fitReply, outcomeFlex, withOutcome } from '../src/line/outcome-reply';
import { checkMessagesAgainstLineLimits, LINE_LIMITS } from '../src/line/message-limits';
import { tFill } from '../src/services/i18n';

describe('fitReply', () => {
  it('keeps the outcome and never returns more than 5 messages', () => {
    const outcome = outcomeFlex({
      language: 'en',
      tone: 'success',
      title: 'Quotation received',
      body: tFill('quoteReceivedWaitingSales', 'en', { name: 'S0001' }),
      actions: [{ label: 'My quotations', text: 'QUOTE LIST' }],
    });
    const extra = Array.from({ length: 6 }, (_, i) => ({ type: 'text' as const, text: `follow-${i}` }));
    const packed = fitReply([outcome, ...extra], 'en');
    expect(packed.length).toBeLessThanOrEqual(LINE_LIMITS.MAX_MESSAGES_PER_REPLY);
    expect(packed[0]).toBe(outcome);
    expect(checkMessagesAgainstLineLimits(packed)).toEqual([]);
  });
});

describe('withOutcome', () => {
  it('prepends the outcome flex before the domain card', () => {
    const outcome = outcomeFlex({ language: 'en', tone: 'success', title: 'Done', body: 'Waiting for sales to send.' });
    const card = { type: 'text' as const, text: 'journey' };
    const packed = withOutcome('en', outcome, [card]);
    expect(packed[0]).toBe(outcome);
    expect(packed[1]).toBe(card);
  });
});

describe('source contracts', () => {
  it('commerce customer create prepends outcomeFlex', () => {
    const commerce = readFileSync('src/line/handlers/commerce.ts', 'utf8');
    expect(commerce).toContain('outcomeFlex');
    expect(commerce).toContain('quoteReceivedWaitingSales');
    expect(commerce).toContain('withOutcome');
  });

  it('quotation add/confirm/approve/invoice prepend outcome', () => {
    const quotation = readFileSync('src/line/handlers/quotation.ts', 'utf8');
    expect(quotation).toContain('quoteLineAddedWaitingSales');
    expect(quotation).toContain('quoteConfirmedStaff');
    expect(quotation).toContain('quoteApproved');
    expect(quotation).toContain('quoteInvoiceCreated');
    expect(quotation).toContain('withOutcome');
  });

  it('resolveCommandReply fits the pack before send', () => {
    const router = readFileSync('src/line/command-router.ts', 'utf8');
    expect(router).toContain('fitReply(raw, ctx.userLanguage)');
    const otp = readFileSync('src/line/handlers/action-otp.ts', 'utf8');
    expect(otp).toContain('fitReply(packed, userLanguage)');
    expect(otp).toContain('otpMissingVerifyUrl');
    expect(otp).toContain('if (!link)');
  });
});
