import { describe, expect, it } from 'vitest';
import { formatQuoteAskNote, formatQuoteReplyNote, pairQuoteAskThreads, stripHtml } from '../src/line/quote-ask';
import { createQuoteAskListFlexMessage } from '../src/line/templates';
import { SERVICE_CATALOG, getVisibleCommands, resolveServiceForCommand, serviceMenuLabel } from '../src/services/service-catalog';

describe('quote ask threads', () => {
  it('pairs QUOTE_ASK notes with later QUOTE_REPLY status and body', () => {
    const threads = pairQuoteAskThreads([
      { body: `<p>${formatQuoteAskNote('Need 10 units', '11')}</p>`, date: '2026-09-01 10:00:00' },
      { body: `<p>${formatQuoteReplyNote('We can ship Friday')}</p>`, date: '2026-09-01 11:00:00' },
      { body: `<p>${formatQuoteAskNote('Any discount?')}</p>`, date: '2026-09-02 09:00:00' },
    ]);
    expect(threads).toHaveLength(2);
    expect(threads[0].ask).toBe('Any discount?');
    expect(threads[0].status).toBe('pending');
    expect(threads[1].ask).toBe('Need 10 units');
    expect(threads[1].productId).toBe('11');
    expect(threads[1].status).toBe('replied');
    expect(threads[1].reply).toBe('We can ship Friday');
  });

  it('strips Odoo html from partner notes', () => {
    expect(stripHtml('<p>QUOTE_ASK</p><p>hello &amp; hi</p>')).toContain('hello & hi');
  });

  it('renders status and reply on the customer list card', () => {
    const json = JSON.stringify(createQuoteAskListFlexMessage([
      { ask: 'Need a quote for App', date: '2026-09-01', status: 'replied', reply: 'Sent SO001' },
    ], 'en'));
    expect(json).toContain('Ask for Quotations');
    expect(json).toContain('Status: Replied');
    expect(json).toContain('Reply: Sent SO001');
    expect(json).toContain('FORM MESSAGE REQUEST');
  });
});

describe('customer commerce menu copy', () => {
  it('shows My Orders then Ask for Quotations for shoppers', () => {
    const commerce = SERVICE_CATALOG.find(s => s.key === 'commerce')!;
    expect(getVisibleCommands(commerce, false, false).map(c => ({ text: c.text, labelEn: c.labelEn }))).toEqual([
      { text: 'QUOTE LIST', labelEn: 'My Orders' },
      { text: 'QUOTE ASK', labelEn: 'Ask for Quotations' },
    ]);
    expect(resolveServiceForCommand('QUOTE ASK')).toBe('commerce');
    expect(serviceMenuLabel(commerce, 'en', 'customer')).toBe('Products & Orders');
    expect(serviceMenuLabel(commerce, 'en', 'sales')).toBe('Products & Quotes');
  });
});
