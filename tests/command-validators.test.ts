import { describe, expect, it } from 'vitest';
import {
  parseDemoQuotePayload,
  parseSelfQuotePayload,
  parseServiceCreatePayload,
  parseServiceUpdatePayload,
  parseUserCreatePayload,
  parseUserUpdatePayload,
  buildSelfQuoteCreateCommand,
} from '../src/line/command-validators';
import { FALLBACK_CUSTOMER_PHONE } from '../src/line/default-contact';

describe('command validators', () => {
  describe('parseUserCreatePayload', () => {
    it('parses valid input with normalized email', () => {
      const result = parseUserCreatePayload(' Razen , +8801787671962 , baizid.a@cloudnexsolutions.com ');
      expect(result).toEqual({
        name: 'Razen',
        phone: '+8801787671962',
        email: 'baizid.a@cloudnexsolutions.com',
      });
    });

    it('rejects invalid phone', () => {
      expect(parseUserCreatePayload('Razen,abc,baizid.a@cloudnexsolutions.com')).toBeNull();
    });

    it('rejects invalid email', () => {
      expect(parseUserCreatePayload('Razen,+8801787671962,wrong-email')).toBeNull();
    });
  });

  describe('parseUserUpdatePayload', () => {
    it('parses update with name only', () => {
      const result = parseUserUpdatePayload('+8801787671962,Razen CEO,,');
      expect(result).toEqual({
        phone: '+8801787671962',
        name: 'Razen CEO',
      });
    });

    it('parses update with new phone and email', () => {
      const result = parseUserUpdatePayload('+8801787671962,,0898765432,new@example.com');
      expect(result).toEqual({
        phone: '+8801787671962',
        newPhone: '0898765432',
        email: 'new@example.com',
      });
    });

    it('rejects when no updates are provided', () => {
      expect(parseUserUpdatePayload('+8801787671962,,,')).toBeNull();
    });
  });

  describe('parseServiceCreatePayload', () => {
    it('parses valid service create payload', () => {
      const result = parseServiceCreatePayload('Premium Support,PS-001,1290');
      expect(result).toEqual({
        name: 'Premium Support',
        code: 'PS-001',
        price: 1290,
      });
    });

    it('normalizes spaces in service code', () => {
      const result = parseServiceCreatePayload('Premium Support,PS 001,1290');
      expect(result?.code).toBe('PS-001');
    });

    it('rejects non-positive price', () => {
      expect(parseServiceCreatePayload('Premium Support,PS-001,0')).toBeNull();
    });
  });

  describe('parseServiceUpdatePayload', () => {
    it('parses valid service update payload', () => {
      const result = parseServiceUpdatePayload('PS-001,New Name,1490,PS-NEW');
      expect(result).toEqual({
        identifier: 'PS-001',
        name: 'New Name',
        price: 1490,
        newCode: 'PS-NEW',
      });
    });

    it('rejects invalid price when provided', () => {
      expect(parseServiceUpdatePayload('PS-001,New Name,abc,PS-NEW')).toBeNull();
    });

    it('rejects when nothing to update', () => {
      expect(parseServiceUpdatePayload('PS-001,,,')).toBeNull();
    });
  });

  describe('parseDemoQuotePayload', () => {
    it('reads shop carousel stay-on-cart from the 10th QUOTE CREATE field', () => {
      expect(parseDemoQuotePayload('id:2,10,Razen,+8801787671962,,,,,,cart')).toMatchObject({
        productId: 2,
        shopNext: 'cart',
      });
      expect(parseDemoQuotePayload('id:2,10,Razen,+8801787671962,,,,,')).not.toHaveProperty('shopNext');
    });

    it('rejects invalid quantity', () => {
      expect(parseDemoQuotePayload('App Premium Plan,0,Razen,+8801787671962')).toBeNull();
      expect(parseDemoQuotePayload('App Premium Plan,10001,Razen,+8801787671962')).toBeNull();
    });

    it('rejects invalid phone', () => {
      expect(parseDemoQuotePayload('App Premium Plan,2,Razen,abc')).toBeNull();
    });

    it('parses the 5 optional trailing fields when all are provided', () => {
      const result = parseDemoQuotePayload('App Premium Plan,2,Razen,+8801787671962,PO-1001,15,2026-12-31,Rush order,30 Days');
      expect(result).toEqual({
        productName: 'App Premium Plan',
        qty: 2,
        customerName: 'Razen',
        phone: '+8801787671962',
        customerReference: 'PO-1001',
        discountPercent: 15,
        validityDate: '2026-12-31',
        note: 'Rush order',
        paymentTerm: '30 Days',
      });
    });

    it('omits optional fields entirely when left blank, same as today\'s behavior', () => {
      const result = parseDemoQuotePayload('App Premium Plan,2,Razen,+8801787671962,,,,,');
      expect(result).toEqual({
        productName: 'App Premium Plan',
        qty: 2,
        customerName: 'Razen',
        phone: '+8801787671962',
      });
    });

    it('omits optional fields entirely when the trailing fields are absent, not just blank', () => {
      const result = parseDemoQuotePayload('App Premium Plan,2,Razen,+8801787671962');
      expect(result).not.toHaveProperty('customerReference');
      expect(result).not.toHaveProperty('discountPercent');
      expect(result).not.toHaveProperty('validityDate');
      expect(result).not.toHaveProperty('note');
      expect(result).not.toHaveProperty('paymentTerm');
    });

    it('rejects an out-of-range discount percent', () => {
      expect(parseDemoQuotePayload('App Premium Plan,2,Razen,+8801787671962,,-1,,,')).toBeNull();
      expect(parseDemoQuotePayload('App Premium Plan,2,Razen,+8801787671962,,101,,,')).toBeNull();
    });

    it('accepts discount percent boundary values 0 and 100', () => {
      expect(parseDemoQuotePayload('App Premium Plan,2,Razen,+8801787671962,,0,,,')?.discountPercent).toBe(0);
      expect(parseDemoQuotePayload('App Premium Plan,2,Razen,+8801787671962,,100,,,')?.discountPercent).toBe(100);
    });

    it('rejects a validity date that is not YYYY-MM-DD', () => {
      expect(parseDemoQuotePayload('App Premium Plan,2,Razen,+8801787671962,,,31-12-2026,,')).toBeNull();
      expect(parseDemoQuotePayload('App Premium Plan,2,Razen,+8801787671962,,,not-a-date,,')).toBeNull();
    });
  });

  describe('parseSelfQuotePayload', () => {
    it('binds product and qty to the verified profile identity', () => {
      expect(parseSelfQuotePayload('App Premium Plan,2', { customerName: 'Razen', phone: FALLBACK_CUSTOMER_PHONE })).toMatchObject({
        productName: 'App Premium Plan',
        qty: 2,
        customerName: 'Razen',
        phone: FALLBACK_CUSTOMER_PHONE,
      });
    });
  });

  describe('buildSelfQuoteCreateCommand', () => {
    it('puts name and phone on a guest qty utterance so QUOTE CREATE can parse', () => {
      expect(buildSelfQuoteCreateCommand('App Premium Plan', 1, {
        customerName: 'Razen',
        phone: FALLBACK_CUSTOMER_PHONE,
      })).toBe(`QUOTE CREATE App Premium Plan,1,Razen,${FALLBACK_CUSTOMER_PHONE}`);
      expect(parseDemoQuotePayload('App Premium Plan,1')).toBeNull();
    });

    it('returns null when the guest has no name or phone, so the form can collect them', () => {
      expect(buildSelfQuoteCreateCommand('App', 1, { customerName: '', phone: FALLBACK_CUSTOMER_PHONE })).toBeNull();
      expect(buildSelfQuoteCreateCommand('App', 1, { customerName: 'Razen', phone: '' })).toBeNull();
    });
  });
});
