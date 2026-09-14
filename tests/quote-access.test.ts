import { describe, expect, it } from 'vitest';
import { canViewOrderAsCustomer, isQuoteStaff, selfQuoteIdentity } from '../src/line/quote-access';

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
    expect(selfQuoteIdentity({ displayName: 'Somchai', phone: '0812345678' })).toEqual({
      customerName: 'Somchai',
      phone: '0812345678',
    });
    expect(isQuoteStaff({ role: 'user' })).toBe(false);
  });
});
