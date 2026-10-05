import { beforeEach, describe, expect, it, vi } from 'vitest';

const peekGuestQuoteSlot = vi.fn();
const consumeGuestQuoteSlot = vi.fn();
const setUserGuestPartner = vi.fn();
const setUserOdooPartner = vi.fn();
const recordAuditEvent = vi.fn();
const lookupCustomer = vi.fn();
const createCustomer = vi.fn();
const updateCustomer = vi.fn();
const createQuotation = vi.fn();
const getOrderLinks = vi.fn();
const getSaleOrderById = vi.fn();

vi.mock('../src/services/firestore', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/services/firestore')>()),
  peekGuestQuoteSlot: (...args: unknown[]) => peekGuestQuoteSlot(...args),
  consumeGuestQuoteSlot: (...args: unknown[]) => consumeGuestQuoteSlot(...args),
  setUserGuestPartner: (...args: unknown[]) => setUserGuestPartner(...args),
  setUserOdooPartner: (...args: unknown[]) => setUserOdooPartner(...args),
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
  setLastProductContext: vi.fn(),
  listVerifiedSalesLineUserIds: async () => [],
}));

vi.mock('../src/erp/registry', () => ({
  getErpAdapter: () => ({
    lookupCustomer: (...args: unknown[]) => lookupCustomer(...args),
    createCustomer: (...args: unknown[]) => createCustomer(...args),
    updateCustomer: (...args: unknown[]) => updateCustomer(...args),
    createQuotation: (...args: unknown[]) => createQuotation(...args),
    lookupProduct: async () => null,
    searchProducts: async () => [],
    getOrderLinks: (...args: unknown[]) => getOrderLinks(...args),
    findPaymentTermId: async () => undefined,
  }),
}));

vi.mock('../src/platform/customer-commerce', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/platform/customer-commerce')>()),
  isCustomerShopEffective: async () => false,
  searchAudienceProducts: async () => [{ id: 2, name: 'App Premium Plan', price: 99, quantity: 10 }],
  attachShopJourney: async (value: unknown) => value,
}));

vi.mock('../src/services/quote-idempotency', () => ({
  beginQuoteCreate: async () => ({ ok: true }),
  completeQuoteCreate: vi.fn(),
  failQuoteCreate: vi.fn(),
  quoteCreateLockKey: () => 'lock',
}));

vi.mock('../src/services/odoo/sales', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/services/odoo/sales')>()),
  getSaleOrderById: (...args: unknown[]) => getSaleOrderById(...args),
}));

vi.mock('../src/line/quote-access', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/line/quote-access')>()),
  syncStaffProfile: async (_id: string, profile: unknown) => profile,
}));

vi.mock('../src/line/quote-notify', () => ({ notifyQuoteParties: async () => undefined }));

import { commerceHandlers } from '../src/line/handlers/commerce';
import type { CommandReplyContext } from '../src/line/command-router';
import { FALLBACK_CUSTOMER_PHONE } from '../src/line/default-contact';

const handler = commerceHandlers.find(h => h.name === 'commerce-quote-create')!;
const EXISTING = 'Acme Secret Co';

const guestCtx = (profile: Record<string, unknown> = {}): CommandReplyContext => ({
  text: `QUOTE CREATE App Premium Plan,1,Razen,${FALLBACK_CUSTOMER_PHONE}`,
  userId: 'Uguest',
  userLanguage: 'en',
  profile: { odooVerified: false, role: 'user', displayName: 'Razen', ...profile } as never,
  agentName: 'Sora',
  baseUrl: 'https://x.example',
  channel: { channelId: 'customer', enabledServices: null },
  requestId: 'req-1',
});

describe('commerce-quote-create guest path', () => {
  beforeEach(() => {
    peekGuestQuoteSlot.mockReset().mockResolvedValue({ ok: true });
    consumeGuestQuoteSlot.mockReset().mockResolvedValue({ ok: true });
    setUserGuestPartner.mockReset().mockResolvedValue({ ok: true });
    setUserOdooPartner.mockReset();
    recordAuditEvent.mockReset();
    lookupCustomer.mockReset().mockResolvedValue({ id: 7, name: EXISTING, phone: FALLBACK_CUSTOMER_PHONE });
    createCustomer.mockReset().mockResolvedValue({ id: 501, name: 'Razen', phone: FALLBACK_CUSTOMER_PHONE });
    updateCustomer.mockReset();
    createQuotation.mockReset().mockResolvedValue({ id: 9, name: 'S00099', total: 100, currency: 'THB' });
    getOrderLinks.mockReset().mockResolvedValue({ portal: '', pdf: '' });
    getSaleOrderById.mockReset().mockResolvedValue({
      id: 9,
      name: 'S00099',
      state: 'draft',
      amount_total: 100,
      partner_id: [501, 'Razen'],
      lines: [{ productId: 2, productName: 'App Premium Plan', qty: 1, priceUnit: 99, subtotal: 99 }],
    });
  });

  it('creates a new guest contact for an existing phone and never shows that contact', async () => {
    const profile: Record<string, unknown> = { odooVerified: false, role: 'user', displayName: 'Razen' };
    const reply = await handler.handle(guestCtx(profile));
    const body = JSON.stringify(reply);
    expect(lookupCustomer).not.toHaveBeenCalled();
    expect(createCustomer).toHaveBeenCalledWith('Razen', FALLBACK_CUSTOMER_PHONE, undefined, { forceNew: true });
    expect(updateCustomer).not.toHaveBeenCalled();
    expect(body).not.toContain(EXISTING);
    expect(body).not.toContain('Acme');
  });

  it('keeps the LINE profile as guest-only after a guest order', async () => {
    const ctx = guestCtx();
    await handler.handle(ctx);
    expect(setUserGuestPartner).toHaveBeenCalledWith('Uguest', 501);
    expect(setUserOdooPartner).not.toHaveBeenCalled();
    expect(ctx.profile.odooVerified).toBe(false);
    expect(ctx.profile.odooPartnerId).toBeUndefined();
    expect(ctx.profile.guestPartnerId).toBe(501);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'guest_quote_create',
      outcome: 'success',
    }));
  });

  it('does not create a guest partner when the quote payload has no phone', async () => {
    await handler.handle({
      ...guestCtx(),
      text: 'QUOTE CREATE App Premium Plan,1,Razen,',
    });
    expect(createCustomer).not.toHaveBeenCalled();
    expect(createQuotation).not.toHaveBeenCalled();
  });

  it('refuses a capped guest quote through commerce-quote-create and audits it', async () => {
    peekGuestQuoteSlot.mockResolvedValue({ ok: false, reason: 'capped' });
    const reply = await handler.handle(guestCtx());
    expect(createCustomer).not.toHaveBeenCalled();
    expect(createQuotation).not.toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'guest_quote_refused',
      outcome: 'failure',
      detail: 'capped',
    }));
    expect(JSON.stringify(reply)).toMatch(/limited to 3 per day/i);
  });

  it('consumes a guest slot on a repeat order that reuses guestPartnerId', async () => {
    const ctx = guestCtx({ guestPartnerId: 501 });
    await handler.handle(ctx);
    expect(createCustomer).not.toHaveBeenCalled();
    expect(updateCustomer).not.toHaveBeenCalled();
    expect(createQuotation).toHaveBeenCalled();
    expect(consumeGuestQuoteSlot).toHaveBeenCalled();
    expect(ctx.profile.odooVerified).toBe(false);
    expect(ctx.profile.odooPartnerId).toBeUndefined();
    expect(ctx.profile.guestPartnerId).toBe(501);
  });

  it('does not create a second guest partner when quotation fails after a new contact this turn', async () => {
    createQuotation.mockResolvedValue(null);
    await handler.handle(guestCtx());
    expect(createCustomer).toHaveBeenCalledOnce();
    expect(setUserGuestPartner).toHaveBeenCalledOnce();
    expect(createQuotation).toHaveBeenCalledOnce();
    expect(consumeGuestQuoteSlot).not.toHaveBeenCalled();
  });

  it('recreates a guest partner only when a stored guestPartnerId is stale', async () => {
    createQuotation
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 9, name: 'S00099', total: 100, currency: 'THB' });
    createCustomer.mockResolvedValue({ id: 777, name: 'Razen', phone: FALLBACK_CUSTOMER_PHONE });
    const ctx = guestCtx({ guestPartnerId: 501 });
    await handler.handle(ctx);
    expect(createCustomer).toHaveBeenCalledOnce();
    expect(setUserGuestPartner).toHaveBeenCalledWith('Uguest', 777);
    expect(createQuotation).toHaveBeenCalledTimes(2);
    expect(ctx.profile.guestPartnerId).toBe(777);
  });
});
