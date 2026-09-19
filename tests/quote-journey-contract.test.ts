import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const quotation = readFileSync('src/line/handlers/quotation.ts', 'utf8');
const router = readFileSync('src/line/command-router.ts', 'utf8');
const verification = readFileSync('src/line/handlers/verification.ts', 'utf8');

const sliceHandler = (source: string, name: string, nextName: string) => {
  const start = source.indexOf(`name: '${name}'`);
  const end = source.indexOf(`name: '${nextName}'`, start + 1);
  expect(start).toBeGreaterThan(-1);
  return source.slice(start, end === -1 ? undefined : end);
};

describe('quote journey home and approve', () => {
  it('does not auto-home after send (waiting for approval)', () => {
    const send = sliceHandler(quotation, 'quote-send-confirm', 'quote-more');
    expect(send).not.toContain('homeMenuFromContext');
  });

  it('does not auto-home after create invoice or staff confirm', () => {
    expect(sliceHandler(quotation, 'quote-invoice', 'quote-list')).not.toContain('homeMenuFromContext');
    expect(sliceHandler(quotation, 'quote-confirm', 'quote-send-options')).not.toContain('homeMenuFromContext');
  });

  it('appends NAV commerce after send, invoice send, cancel, and approve', () => {
    expect(sliceHandler(quotation, 'quote-send-confirm', 'quote-more')).toContain('withCommerceMenu');
    expect(sliceHandler(quotation, 'quote-invoice-send-confirm', 'quote-invoice')).toContain('withCommerceMenu');
    expect(sliceHandler(quotation, 'quote-cancel', 'quote-invoice-send')).toContain('withCommerceMenu');
    expect(sliceHandler(quotation, 'quote-approve', 'quote-add')).toContain('withCommerceMenu');
    expect(sliceHandler(quotation, 'quote-approve', 'quote-add')).toContain('salesIntro');
    expect(sliceHandler(quotation, 'quote-invoice-send-confirm', 'quote-invoice')).not.toContain('homeMenuFromContext');
    expect(sliceHandler(quotation, 'quote-cancel', 'quote-invoice-send')).not.toContain('homeMenuFromContext');
  });

  it('notifies sales on approve without auto-home', () => {
    const approve = sliceHandler(quotation, 'quote-approve', 'quote-add');
    expect(approve).toContain('salesIntro');
    expect(approve).toContain('quoteApprovedStaff');
    expect(approve).toContain('notifyCustomer: false');
    expect(approve).not.toContain('buildHomeMenuMessage');
  });
});

describe('unverify confirm copy', () => {
  it('asks before VERIFY SIGNOUT and does not clear the session on FORM VERIFY', () => {
    expect(router).toContain('End verification session?');
    expect(router).toContain('Confirm to sign out of the sales session, or cancel to keep it on.');
    expect(router).toContain('ปิดเซสชันยืนยัน?');
    expect(router).toContain("text: 'VERIFY SIGNOUT'");
    expect(router).toContain("text: 'NAV HOME'");
    expect(verification).toContain("u === 'VERIFY SIGNOUT'");
    expect(verification).toContain('clearSalesLogin');
  });
});
