import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canonicalizeInboundCommand, sanitizeCommandOverlay, setCommandOverlayCacheForTests } from '../src/line/command-overlay';
import { inboundCreateQuoteCommand, parseInboundRfq } from '../src/line/inbound-relay';
import { QUOTE_LIST_PAGE_SIZE } from '../src/line/handlers/quotation';
import { tFill } from '../src/services/i18n';

describe('P1 sales home and list page', () => {
  it('keeps quote list pages at 5 to match Next 5', () => {
    expect(QUOTE_LIST_PAGE_SIZE).toBe(5);
    expect(readFileSync('src/line/templates/quotation.ts', 'utf8')).toContain("t('nextPage', language)");
  });

  it('Sales User quote list is sale.order user_id via Sales groups', () => {
    const quotation = readFileSync('src/line/handlers/quotation.ts', 'utf8');
    const admin = readFileSync('src/services/odoo/admin.ts', 'utf8');
    const sales = readFileSync('src/services/odoo.ts', 'utf8');
    expect(quotation).toContain('getSaleOrdersForSalesperson');
    expect(quotation).toContain("listMode !== 'lookup' && isQuoteStaff(profile) && partnerId");
    expect(sales).toContain("[['user_id', '=', odooUserId]]");
    expect(admin).toContain("['module', '=', 'sales_team']");
    expect(admin).toContain('group_sale_salesman');
    expect(admin).toContain('group_sale_manager');
  });

  it('staff Home is commerce menu plus QUOTE LIST', () => {
    const router = readFileSync('src/line/command-router.ts', 'utf8');
    expect(router).toContain('pendingQuoteListPush');
    expect(router).toContain('syncStaffProfile(ctx.userId, ctx.profile, ctx.channel?.channelId)');
    expect(router).toContain('commerceFollowUpMessages');
    expect(readFileSync('src/line/process-message.ts', 'utf8')).toContain('pushDeferredSalesQuoteList');
    expect(readFileSync('src/line/commerce-followup.ts', 'utf8')).toContain("text: 'QUOTE LIST'");
  });

  it('names the salesperson after customer approve', () => {
    expect(tFill('quoteApprovedProcessing', 'en', { name: 'Mali' })).toBe('Mali is processing your order.');
    expect(tFill('quoteApprovedProcessing', 'th', { name: 'มาลี' })).toContain('มาลี');
  });
});

describe('P1 RFQ create quote', () => {
  it('builds FORM QUOTE CREATE FROM CARD with product, qty, and customer LINE id', () => {
    expect(inboundCreateQuoteCommand({ customerUserId: 'Uabc', productId: 11, qty: 20 }))
      .toBe('FORM QUOTE CREATE FROM CARD 11 20 Uabc');
    expect(inboundCreateQuoteCommand({ customerUserId: 'Uabc' })).toBe('FORM QUOTE CREATE');
  });

  it('parses productId and qty from inbound snippets', () => {
    expect(parseInboundRfq('productId=11\nqty=20\nNeed a quote')).toEqual({
      productId: 11,
      qty: 20,
      text: 'Need a quote',
    });
  });
});

describe('P4 overlay aliases', () => {
  afterEach(() => setCommandOverlayCacheForTests({}));

  it('rejects alias collisions with another prefix or another command', () => {
    expect(sanitizeCommandOverlay({ 'nav-home': { aliases: ['NAV COMMERCE'] } }).ok).toBe(false);
    const both = sanitizeCommandOverlay({
      'nav-home': { aliases: ['HQ'] },
      'nav-commerce': { aliases: ['HQ'] },
    });
    expect(both.ok).toBe(false);
  });

  it('normalizes inbound aliases to canonical prefixes and keeps a suffix', () => {
    setCommandOverlayCacheForTests({ 'nav-commerce': { aliases: ['PRODUCTS'] } });
    expect(canonicalizeInboundCommand('products')).toBe('NAV COMMERCE');
    expect(canonicalizeInboundCommand('PRODUCTS extra')).toBe('NAV COMMERCE extra');
    expect(canonicalizeInboundCommand('QUOTE LIST')).toBe('QUOTE LIST');
  });
});
