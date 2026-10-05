import { describe, expect, it } from 'vitest';
import { applyChannelPersona, canViewOrderAsCustomer, customerQuoteFormStepCount, customerQuoteSkipsOptionalSummary, isQuoteStaff, selfQuoteIdentity, skipCustomerQuoteIdentityIndex, skipsCustomerQuoteIdentityFields } from '../src/line/quote-access';
import { FLOW_SPECS } from '../src/services/guided-forms';
import { FALLBACK_CUSTOMER_NAME, FALLBACK_CUSTOMER_PHONE } from '../src/line/default-contact';

describe('canViewOrderAsCustomer', () => {
  it('lets staff view any partner', () => {
    expect(canViewOrderAsCustomer({ role: 'user', salesTier: 'salesperson', odooPartnerId: 1 }, 99)).toBe(true);
  });

  it('lets a customer view only their own partner', () => {
    const customer = { role: 'user' as const, odooPartnerId: 42 };
    expect(canViewOrderAsCustomer(customer, 42)).toBe(true);
    expect(canViewOrderAsCustomer(customer, 99)).toBe(false);
    expect(canViewOrderAsCustomer({ role: 'user' }, 42)).toBe(false);
  });
});

describe('selfQuoteIdentity', () => {
  it('uses the verified profile, not staff form fields', () => {
    expect(selfQuoteIdentity({ displayName: FALLBACK_CUSTOMER_NAME, phone: FALLBACK_CUSTOMER_PHONE })).toEqual({
      customerName: FALLBACK_CUSTOMER_NAME,
      phone: FALLBACK_CUSTOMER_PHONE,
    });
    expect(isQuoteStaff({ role: 'user' })).toBe(false);
  });

  it('strips sales admin on Customer OA', () => {
    const stripped = applyChannelPersona({
      language: 'en',
      role: 'admin',
      odooVerified: true,
      marketingOptIn: false,
      salesTier: 'sales_manager',
      displayName: FALLBACK_CUSTOMER_NAME,
    }, 'customer');
    expect(stripped.salesTier).toBeUndefined();
    expect(stripped.role).toBe('user');
    expect(isQuoteStaff(stripped)).toBe(false);
  });
});

describe('customer quote form (C3)', () => {
  it('is product and qty only for customers, full form for staff', () => {
    expect(customerQuoteFormStepCount('QUOTE_CREATE', 9, { role: 'user', odooVerified: true })).toBe(2);
    expect(customerQuoteFormStepCount('QUOTE_CREATE', 9, { role: 'user', odooVerified: false })).toBe(4);
    expect(skipsCustomerQuoteIdentityFields({ role: 'user', odooVerified: true })).toBe(true);
    expect(skipsCustomerQuoteIdentityFields({ role: 'user', odooVerified: false })).toBe(false);
    expect(customerQuoteFormStepCount('QUOTE_CREATE', 9, { role: 'user', salesTier: 'salesperson' })).toBe(9);
    expect(customerQuoteSkipsOptionalSummary('QUOTE_CREATE', { role: 'user' })).toBe(true);
    expect(customerQuoteSkipsOptionalSummary('QUOTE_CREATE', { role: 'admin' })).toBe(false);
  });

  it('skips name and phone indexes only for a verified customer', () => {
    const fields = FLOW_SPECS.QUOTE_CREATE.fields;
    const nameIndex = fields.findIndex(field => field.key === 'customerName');
    const qtyIndex = fields.findIndex(field => field.key === 'qty');
    expect(skipCustomerQuoteIdentityIndex('QUOTE_CREATE', fields, nameIndex, { role: 'user', odooVerified: true })).toBe(nameIndex + 2);
    expect(skipCustomerQuoteIdentityIndex('QUOTE_CREATE', fields, qtyIndex, { role: 'user', odooVerified: true })).toBe(qtyIndex);
    expect(skipCustomerQuoteIdentityIndex('QUOTE_CREATE', fields, nameIndex, { role: 'user', odooVerified: false })).toBe(nameIndex);
    expect(skipCustomerQuoteIdentityIndex('QUOTE_CREATE', fields, nameIndex, { role: 'user', salesTier: 'salesperson' })).toBe(nameIndex);
  });
});
