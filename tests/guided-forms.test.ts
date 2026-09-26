import { describe, expect, it } from 'vitest';
import { FLOW_SPECS, getFlowByStartCommand, loadVerifyPhoneOptions, nextLinearFieldIndex } from '../src/services/guided-forms';
import { pickDefaultPaymentTermName } from '../src/services/odoo/sales';

describe('getFlowByStartCommand', () => {
  it('resolves each flow by its exact start command', () => {
    expect(getFlowByStartCommand('FORM USER CREATE')?.key).toBe('USER_CREATE');
    expect(getFlowByStartCommand('FORM USER READ')?.key).toBe('USER_READ');
    expect(getFlowByStartCommand('FORM SERVICE CREATE')?.key).toBe('SERVICE_CREATE');
    expect(getFlowByStartCommand('FORM SERVICE READ')?.key).toBe('SERVICE_READ');
    expect(getFlowByStartCommand('FORM PRODUCT FIND')?.key).toBe('PRODUCT_FIND');
    expect(getFlowByStartCommand('FORM ORDER STATUS')?.key).toBe('ORDER_STATUS');
    expect(getFlowByStartCommand('FORM QUOTE CREATE')?.key).toBe('QUOTE_CREATE');
    expect(getFlowByStartCommand('FORM QUOTE ADD')?.key).toBe('QUOTE_ADD');
    expect(getFlowByStartCommand('FORM CUSTOMER REGISTER')?.key).toBe('CUSTOMER_REGISTER');
  });

  it('returns null for an unknown form command', () => {
    expect(getFlowByStartCommand('FORM NOPE')).toBeNull();
  });

  it('matchFlowForPreview accepts the reconstructed command prefix', async () => {
    const { matchFlowForPreview } = await import('../src/services/guided-forms');
    expect(matchFlowForPreview('FORM USER CREATE')).not.toBeNull();
    expect(matchFlowForPreview('USER CREATE Jane,0812345678')?.key).toBe('USER_CREATE');
  });
});

describe('lookup flows', () => {
  it('builds product, order, user, and service lookup commands', () => {
    expect(FLOW_SPECS.PRODUCT_FIND.buildFinalCommand({ productName: 'App Premium Plan' })).toBe('PRODUCT FIND App Premium Plan');
    expect(FLOW_SPECS.ORDER_STATUS.buildFinalCommand({ reference: 'SO0001' })).toBe('ORDER STATUS SO0001');
    expect(FLOW_SPECS.USER_READ.buildFinalCommand({ phone: '0812345678' })).toBe('USER READ 0812345678');
    expect(FLOW_SPECS.SERVICE_READ.buildFinalCommand({ identifier: 'SVC-PREMIUM' })).toBe('SERVICE READ SVC-PREMIUM');
  });

  it('keeps admin-only protection on user lookup', () => {
    expect(FLOW_SPECS.USER_READ.requiresAdmin).toBe(true);
    expect(FLOW_SPECS.PRODUCT_FIND.requiresAdmin).toBe(false);
    expect(FLOW_SPECS.ORDER_STATUS.requiresAdmin).toBe(false);
    expect(FLOW_SPECS.SERVICE_READ.requiresAdmin).toBe(false);
  });
});

describe('USER_CREATE flow', () => {
  const spec = FLOW_SPECS.USER_CREATE;

  it('requires admin', () => {
    expect(spec.requiresAdmin).toBe(true);
  });

  it('validates each field', () => {
    const [name, phone, email] = spec.fields;
    expect(name.validate('Somchai')).toBe(true);
    expect(name.validate('  ')).toBe(false);
    expect(phone.validate('0812345678')).toBe(true);
    expect(phone.validate('abc')).toBe(false);
    expect(email.validate('')).toBe(true);
    expect(email.validate('somchai@example.com')).toBe(true);
    expect(email.validate('not-an-email')).toBe(false);
  });

  it('builds the final command with an optional email included', () => {
    const cmd = spec.buildFinalCommand({ name: 'Somchai', phone: '0812345678', email: 'somchai@example.com' });
    expect(cmd).toBe('USER CREATE Somchai,0812345678,somchai@example.com');
  });

  it('builds the final command with the optional email omitted', () => {
    const cmd = spec.buildFinalCommand({ name: 'Somchai', phone: '0812345678', email: '' });
    expect(cmd).toBe('USER CREATE Somchai,0812345678');
  });
});

describe('SERVICE_CREATE flow', () => {
  const spec = FLOW_SPECS.SERVICE_CREATE;

  it('requires admin and validates a positive price', () => {
    expect(spec.requiresAdmin).toBe(true);
    const priceField = spec.fields.find(f => f.key === 'price')!;
    expect(priceField.validate('990')).toBe(true);
    expect(priceField.validate('0')).toBe(false);
    expect(priceField.validate('abc')).toBe(false);
  });

  it('builds the final command', () => {
    const cmd = spec.buildFinalCommand({ name: 'Premium Support', code: 'SVC-PREMIUM', price: '990' });
    expect(cmd).toBe('SERVICE CREATE Premium Support,SVC-PREMIUM,990');
  });
});

describe('USER_UPDATE flow', () => {
  const spec = FLOW_SPECS.USER_UPDATE;

  it('requires admin and resolves by start command', () => {
    expect(spec.requiresAdmin).toBe(true);
    expect(getFlowByStartCommand('FORM USER UPDATE')?.key).toBe('USER_UPDATE');
  });

  it('builds the final command with skipped optional fields left blank', () => {
    const cmd = spec.buildFinalCommand({ phone: '0812345678', name: '', newPhone: '', email: '' });
    expect(cmd).toBe('USER UPDATE 0812345678,,,');
  });

  it('builds the final command with optional fields filled in', () => {
    const cmd = spec.buildFinalCommand({ phone: '0812345678', name: 'Somchai CEO', newPhone: '', email: 'somchai@example.com' });
    expect(cmd).toBe('USER UPDATE 0812345678,Somchai CEO,,somchai@example.com');
  });
});

describe('USER_DELETE flow', () => {
  const spec = FLOW_SPECS.USER_DELETE;

  it('requires admin and builds the final command', () => {
    expect(spec.requiresAdmin).toBe(true);
    expect(getFlowByStartCommand('FORM USER DELETE')?.key).toBe('USER_DELETE');
    expect(spec.buildFinalCommand({ phone: '0812345678' })).toBe('USER DELETE 0812345678');
  });
});

describe('SERVICE_UPDATE flow', () => {
  const spec = FLOW_SPECS.SERVICE_UPDATE;

  it('requires admin and resolves by start command', () => {
    expect(spec.requiresAdmin).toBe(true);
    expect(getFlowByStartCommand('FORM SERVICE UPDATE')?.key).toBe('SERVICE_UPDATE');
  });

  it('builds the final command with optional fields filled in', () => {
    const cmd = spec.buildFinalCommand({ identifier: 'SVC-PREMIUM', name: '', price: '1290', newCode: 'SVC-PRO' });
    expect(cmd).toBe('SERVICE UPDATE SVC-PREMIUM,,1290,SVC-PRO');
  });
});

describe('SERVICE_DELETE flow', () => {
  const spec = FLOW_SPECS.SERVICE_DELETE;

  it('requires admin and builds the final command', () => {
    expect(spec.requiresAdmin).toBe(true);
    expect(getFlowByStartCommand('FORM SERVICE DELETE')?.key).toBe('SERVICE_DELETE');
    expect(spec.buildFinalCommand({ identifier: 'SVC-PRO' })).toBe('SERVICE DELETE SVC-PRO');
  });
});

describe('QUOTE_CREATE flow', () => {
  const spec = FLOW_SPECS.QUOTE_CREATE;

  it('does not skip qty/customer after product even if a prior quote left those keys', () => {
    const leftover = { productName: 'Care', qty: '1', customerName: 'Old', phone: '0812345678', paymentTerm: '30 Days' };
    expect(nextLinearFieldIndex(spec, leftover, 1)).toBe(1);
    expect(spec.fields[1].key).toBe('qty');
  });

  it('uses saved Odoo partner phones on step 4, not a second verify flow', () => {
    const phoneField = spec.fields[3];
    expect(phoneField.key).toBe('phone');
    expect(phoneField.loadOptions).toBeTypeOf('function');
    expect(spec.fields.map(f => f.key)).toEqual([
      'productName', 'qty', 'customerName', 'phone',
      'customerReference', 'discountPercent', 'validityDate', 'note', 'paymentTerm',
    ]);
  });

  it('builds the final command with a product id when seeded from a card', () => {
    const cmd = spec.buildFinalCommand({
      productName: 'App, Premium', productId: '99', qty: '1', customerName: 'Somchai', phone: '0812345678',
    });
    expect(cmd).toBe('QUOTE CREATE id:99,1,Somchai,0812345678,,,,,');
  });

  it('builds the final command with skipped optional fields left blank', () => {
    const cmd = spec.buildFinalCommand({ productName: 'App Premium Plan', qty: '1', customerName: 'Somchai', phone: '0812345678' });
    expect(cmd).toBe('QUOTE CREATE App Premium Plan,1,Somchai,0812345678,,,,,');
  });

  it('builds the final command with optional fields filled in', () => {
    const cmd = spec.buildFinalCommand({
      productName: 'App Premium Plan', qty: '1', customerName: 'Somchai', phone: '0812345678',
      customerReference: 'PO-1001', discountPercent: '10', validityDate: '2026-12-31',
      note: 'Rush order', paymentTerm: '30 Days',
    });
    expect(cmd).toBe('QUOTE CREATE App Premium Plan,1,Somchai,0812345678,PO-1001,10,2026-12-31,Rush order,30 Days');
  });

  it('gives validityDate a computed default (today + 30 days) and no other optional field one', () => {
    const validityField = spec.fields.find(f => f.key === 'validityDate')!;
    const defaultDate = validityField.defaultValue?.();
    expect(defaultDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(validityField.validate(defaultDate!)).toBe(true);

    const expected = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(defaultDate).toBe(expected);

    const otherOptionalFields = spec.fields.filter(f => f.optional && f.key !== 'validityDate');
    expect(otherOptionalFields.every(f => !f.defaultValue)).toBe(true);
    expect(spec.fields.find(f => f.key === 'paymentTerm')?.loadDefault).toBeTypeOf('function');
  });
});

describe('pickDefaultPaymentTermName', () => {
  it('prefers Immediate Payment over the first Odoo row', () => {
    expect(pickDefaultPaymentTermName([
      { id: 1, name: '30 Days' },
      { id: 2, name: 'Immediate Payment' },
    ])).toBe('Immediate Payment');
  });

  it('falls back to the first named term', () => {
    expect(pickDefaultPaymentTermName([{ id: 1, name: '15 Days' }])).toBe('15 Days');
  });
});

describe('QUOTE_ADD flow', () => {
  it('rebuilds QUOTE ADD with product id when the chip stored one', () => {
    expect(FLOW_SPECS.QUOTE_ADD.buildFinalCommand({ orderId: '17', productName: 'Widget', productId: '42', qty: '2' })).toBe('QUOTE ADD 17 id:42,2');
    expect(FLOW_SPECS.QUOTE_ADD.buildFinalCommand({ orderId: '17', productName: 'Widget', qty: '2' })).toBe('QUOTE ADD 17 Widget,2');
  });
});

describe('QUOTE_SEND and INVOICE_SEND flows', () => {
  it('reconstructs confirm commands with channel and email', () => {
    expect(FLOW_SPECS.QUOTE_SEND.buildFinalCommand({ orderId: '17', channel: 'LINE' })).toBe('QUOTE SEND CONFIRM 17 LINE');
    expect(FLOW_SPECS.QUOTE_SEND.buildFinalCommand({ orderId: '17', channel: 'EMAIL', email: 'a@b.com', template: 'Hello' })).toBe('QUOTE SEND CONFIRM 17 EMAIL a@b.com | Hello');
    expect(FLOW_SPECS.INVOICE_SEND.buildFinalCommand({ orderId: '17', channel: 'BOTH', email: 'a@b.com' })).toBe('QUOTE INVOICE SEND CONFIRM 17 BOTH a@b.com');
    expect(FLOW_SPECS.QUOTE_SEND.fields.find(f => f.key === 'email')?.skipWhen?.({ channel: 'LINE' })).toBe(true);
    expect(FLOW_SPECS.QUOTE_SEND.fields.find(f => f.key === 'email')?.skipWhen?.({ channel: 'EMAIL' })).toBe(false);
    expect(nextLinearFieldIndex(FLOW_SPECS.QUOTE_SEND, { channel: 'LINE' }, 1)).toBe(2);
    expect(nextLinearFieldIndex(FLOW_SPECS.QUOTE_SEND, { channel: 'EMAIL' }, 1)).toBe(1);
    expect(getFlowByStartCommand('FORM INVOICE SEND')?.key).toBe('INVOICE_SEND');
  });
});

describe('VERIFY phone chips', () => {
  it('prefills the LINE session phone without calling Odoo', async () => {
    await expect(loadVerifyPhoneOptions({ savedPhone: '0812345678' })).resolves.toEqual(['0812345678']);
    expect(FLOW_SPECS.VERIFY.fields[0].loadOptions).toBe(loadVerifyPhoneOptions);
  });
});
