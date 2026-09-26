import { describe, expect, it } from 'vitest';
import { parseCustomerQtyChips, customerQtyChipLabels } from '../src/line/customer-qty';
import { shouldApplyTrayAfterReply } from '../src/line/tray-policy';
import { stateLabel } from '../src/services/i18n';
import { COMMAND_GRID } from '../src/line/command-grid';
import { catalogUiLabel } from '../src/line/catalog-ui';
import { readFileSync } from 'node:fs';

describe('customer qty chips', () => {
  it('defaults to 10–50 by fives and stays within the LINE chip budget', () => {
    expect(parseCustomerQtyChips('')).toEqual([10, 15, 20, 25, 30, 35, 40, 45, 50]);
    expect(customerQtyChipLabels('10,15,20,25,30,35,40,45,50').length + 2).toBeLessThanOrEqual(13);
    expect(parseCustomerQtyChips('1,x,99,99').length).toBeLessThanOrEqual(11);
  });
});

describe('customer glossary', () => {
  it('keeps Sales quotation sent copy and uses Quotation Received for customers', () => {
    expect(stateLabel('sent', 'en')).toBe('Quotation Sent');
    expect(stateLabel('sent', 'en', 'customer')).toBe('Quotation Received');
    expect(stateLabel('draft', 'en', 'customer')).toBe('Order');
    expect(catalogUiLabel('glossary-request-for-order', 'en', { en: 'Request for Order', th: 'ขอสั่งซื้อ' })).toBe('Request for Order');
    expect(catalogUiLabel('quote-list-customer', 'en', { en: 'Order History', th: 'ประวัติคำสั่งซื้อ' })).toBe('Order History');
    expect(COMMAND_GRID.some(row => row.id === 'glossary-quotation-received' && row.uiOnly)).toBe(true);
  });
});

describe('customer keyboard tray policy', () => {
  it('does not restore the default tray while a form is pending', () => {
    expect(shouldApplyTrayAfterReply({ pendingFlow: true })).toBe(false);
    const processMessage = readFileSync('src/line/process-message.ts', 'utf8');
    expect(processMessage).toContain('applyKeyboardRichMenu');
    expect(processMessage).toContain('pendingCatalogPush');
    expect(processMessage).toMatch(/pendingCatalogPush[\s\S]*applyTray/);
  });
});
