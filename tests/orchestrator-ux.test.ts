import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRequiredResumeFlexMessage, createGuideCategoriesFlexMessage, createIdentityStripFlexMessage } from '../src/line/templates';
import { FLOW_SPECS, nextLinearFieldIndex } from '../src/services/guided-forms';
import { parseQtyProductUtterance } from '../src/line/command-validators';
import { resetFeatureToggleCacheForTests } from '../src/services/feature-toggles';
import { isServiceEnabledForChannel } from '../src/services/service-catalog';

describe('staff required resume Flex', () => {
  it('lists filled required rows and Continue / FORM FIELD', () => {
    const message = createRequiredResumeFlexMessage({
      title: 'Sora Create a quote',
      language: 'en',
      continueLabel: 'Continue',
      fields: [
        { index: 0, label: 'Product name?', value: 'Care' },
        { index: 1, label: 'Quantity?', value: '1' },
        { index: 2, label: "Customer's name?" },
        { index: 3, label: "Customer's phone?", value: '0812345678' },
      ],
    });
    const json = JSON.stringify(message);
    expect(json).toContain('FORM CONTINUE');
    expect(json).toContain('FORM CHANGE');
    expect(json).toContain('FORM FIELD 0');
    expect(json).toContain('Care');
    expect(json).toContain('Saved from last time');
    expect(json).not.toContain('FORM FINALIZE');
  });
});

describe('forward prefill does not skip qty', () => {
  it('stays on qty when only productName is collected', () => {
    expect(nextLinearFieldIndex(FLOW_SPECS.QUOTE_CREATE, { productName: 'Care' }, 1)).toBe(1);
  });
});

describe('GUIDE hides groupBuy when live-off', () => {
  it('omits the Group-Buy category from the topic list', () => {
    resetFeatureToggleCacheForTests({ groupBuy: false });
    expect(isServiceEnabledForChannel('groupBuy')).toBe(false);
    const message = createGuideCategoriesFlexMessage('en', 'Sora', ['basics', 'commerce', 'account']);
    const json = JSON.stringify(message);
    expect(json).toContain('GUIDE commerce');
    expect(json).not.toContain('GUIDE groupBuy');
  });
});

describe('customer qty utterance', () => {
  it('parses 2 units product name', () => {
    expect(parseQtyProductUtterance('2 units App Premium')).toEqual({ qty: 2, productName: 'App Premium' });
    expect(parseQtyProductUtterance('QUOTE CREATE x')).toBeNull();
  });
});

describe('source contracts', () => {
  it('hides Verify on Home when already verified', () => {
    const router = readFileSync('src/line/command-router.ts', 'utf8');
    expect(router).toContain('resumeMode');
    expect(router).toContain('FORM CONTINUE');
    expect(router).toContain('FORM CHANGE');
    expect(router).toContain('createIdentityStripFlexMessage');
    expect(router).toContain('hasActiveSalesSession(profile) || profile.odooVerified');
    expect(router).toContain('CUSTOMER_CHANNEL_ID');
    expect(router).toContain('createProductCarouselFlexMessage');
    expect(router).toContain('fitReply');
  });

  it('customer quotes leave salesperson unassigned', () => {
    const odoo = readFileSync('src/services/odoo.ts', 'utf8');
    const commerce = readFileSync('src/line/handlers/commerce.ts', 'utf8');
    expect(odoo).toContain('orderFields.user_id = false');
    expect(odoo).toContain("write', [[orderId], { user_id: false }]");
    expect(commerce).toContain('salespersonUserId = false');
  });

  it('QUOTE STATUS without an id lists the customer quotes', () => {
    const quotation = readFileSync('src/line/handlers/quotation.ts', 'utf8');
    expect(quotation).toContain("text: 'QUOTE LIST'");
    expect(quotation).toContain('safeJourneyExtras');
    expect(quotation).toContain('FORM QUOTE ADD');
    expect(quotation).toContain('withOutcome');
  });

  it('verify unknown-phone cards include GUIDE', () => {
    const verification = readFileSync('src/line/handlers/verification.ts', 'utf8');
    expect(verification).toContain("text: 'GUIDE'");
    expect(verification).toContain('FORM CUSTOMER REGISTER');
  });
});

describe('customer identity strip', () => {
  it('renders verified name and phone', () => {
    const json = JSON.stringify(createIdentityStripFlexMessage({ name: 'Somchai', phone: '0812345678' }, 'en'));
    expect(json).toContain('Somchai');
    expect(json).toContain('0812345678');
  });
});
