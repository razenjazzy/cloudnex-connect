import { beforeEach, describe, expect, it, vi } from 'vitest';

const order = (partnerId: number, lines: Array<Record<string, unknown>>) => ({ id: 9, name: 'S00009', state: 'sale', amount_total: 100, partner_id: [partnerId, 'Acme Co'], lines });
const getSaleOrderById = vi.fn();
const resolveCommandReply = vi.fn(async () => [{ type: 'text', text: 'created' }]);

vi.mock('../src/services/odoo/sales', async importOriginal => ({ ...(await importOriginal<typeof import('../src/services/odoo/sales')>()), getSaleOrderById: (...args: unknown[]) => getSaleOrderById(...args) }));
vi.mock('../src/services/odoo/partners', async importOriginal => ({ ...(await importOriginal<typeof import('../src/services/odoo/partners')>()), getPartnerById: async () => ({ id: 7, name: 'Acme Co', phone: '+8801787671962' }) }));
vi.mock('../src/line/command-router', () => ({ resolveCommandReply: (...args: unknown[]) => resolveCommandReply(...(args as [])) }));
vi.mock('../src/line/quote-access', async importOriginal => ({ ...(await importOriginal<typeof import('../src/line/quote-access')>()), syncStaffProfile: async (_id: string, profile: unknown) => profile }));

import { quotationHandlers } from '../src/line/handlers/quotation';
import type { CommandReplyContext } from '../src/line/command-router';

const handler = quotationHandlers.find(h => h.name === 'quote-again')!;
const ctx = (profile: Record<string, unknown>): CommandReplyContext => ({
  text: 'QUOTE AGAIN 9', userId: 'Uabc', userLanguage: 'en', profile: profile as never, agentName: 'Sora', baseUrl: 'https://x.example',
  channel: { channelId: 'customer', enabledServices: null },
});

describe('QUOTE AGAIN (Order Again / Quote Again)', () => {
  beforeEach(() => { getSaleOrderById.mockReset(); resolveCommandReply.mockClear(); });

  it('customer: repeats the main item of their own order through the single QUOTE CREATE path', async () => {
    getSaleOrderById.mockResolvedValue(order(7, [{ productId: 3, productName: 'Widget', qty: 4, priceUnit: 10, subtotal: 40 }]));
    await handler.handle(ctx({ odooVerified: true, odooPartnerId: 7, role: 'user' }));
    expect(resolveCommandReply).toHaveBeenCalledWith(expect.objectContaining({ text: 'QUOTE CREATE id:3,4' }));
  });

  it("customer cannot repeat someone else's order", async () => {
    getSaleOrderById.mockResolvedValue(order(99, [{ productId: 3, productName: 'Widget', qty: 4, priceUnit: 10, subtotal: 40 }]));
    const reply = await handler.handle(ctx({ odooVerified: true, odooPartnerId: 7, role: 'user' }));
    expect(resolveCommandReply).not.toHaveBeenCalled();
    expect(JSON.stringify(reply)).toBeTruthy();
  });

  it('sales: quotes the same customer again with their name and phone', async () => {
    getSaleOrderById.mockResolvedValue(order(7, [{ productId: 3, productName: 'Widget', qty: 2, priceUnit: 10, subtotal: 20 }, { productId: 5, productName: 'Gadget', qty: 1, priceUnit: 5, subtotal: 5 }]));
    const reply = await handler.handle({ ...ctx({ odooVerified: true, salesTier: 'salesperson', role: 'user', odooPartnerId: 1 }), channel: { channelId: 'sales', enabledServices: null } });
    expect(resolveCommandReply).toHaveBeenCalledWith(expect.objectContaining({ text: 'QUOTE CREATE id:3,2,Acme Co,+8801787671962' }));
    expect(JSON.stringify(reply)).toContain('first item');
  });

  it('skips delivery lines and replies when nothing can be repeated', async () => {
    getSaleOrderById.mockResolvedValue(order(7, [{ productId: 8, productName: 'Delivery', qty: 1, priceUnit: 5, subtotal: 5, isDelivery: true }]));
    const reply = await handler.handle(ctx({ odooVerified: true, odooPartnerId: 7, role: 'user' }));
    expect(resolveCommandReply).not.toHaveBeenCalled();
    expect(JSON.stringify(reply)).toContain('no product line');
  });
});

import { createQuotationJourneyFlexMessage } from '../src/line/templates/quotation';

describe('journey card Again button', () => {
  const card = (state: string, role: 'admin' | 'customer') =>
    JSON.stringify(createQuotationJourneyFlexMessage({ ...order(7, []), state } as never, { role }, 'en'));

  it('shows Order Again to customers and Quote Again to sales on past orders only', () => {
    expect(card('sale', 'customer')).toContain('QUOTE AGAIN 9');
    expect(card('sale', 'customer')).toContain('Order Again');
    expect(card('sale', 'admin')).toContain('Quote Again');
    expect(card('cancel', 'customer')).toContain('QUOTE AGAIN 9');
    expect(card('draft', 'customer')).not.toContain('QUOTE AGAIN');
    expect(card('sent', 'admin')).not.toContain('QUOTE AGAIN');
  });
});
