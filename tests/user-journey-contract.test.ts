import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const router = readFileSync('src/line/command-router.ts', 'utf8');
const quotation = readFileSync('src/line/handlers/quotation.ts', 'utf8');
const commerce = readFileSync('src/line/handlers/commerce.ts', 'utf8');
const followup = readFileSync('src/line/commerce-followup.ts', 'utf8');
const nav = readFileSync('src/line/handlers/navigation.ts', 'utf8');

describe('USER_JOURNEY C0–C5 source contract', () => {
  it('C0: home identity only after odooVerified', () => {
    expect(router).toContain('!staff && profile.odooVerified && (profile.displayName || profile.phone)');
    expect(router).toContain('applyChannelPersona');
  });

  it('C1: guest commerce NAV and product find use the kilo carousel', () => {
    expect(nav).toContain("key === 'commerce'");
    expect(nav).toContain('commerceFollowUpMessages');
    expect(followup).toContain('createProductCarouselFlexMessage');
    expect(commerce).toContain('createProductCarouselFlexMessage(catalog, userLanguage)');
  });

  it('C3: guests must VERIFY before quote; customers skip optional summary', () => {
    expect(router).toContain('FORM QUOTE CREATE FROM CARD');
    expect(commerce).toContain('Verify your account before creating a quote.');
    expect(commerce).toContain('parseSelfQuotePayload');
  });

  it('C4: customer Confirm is QUOTE APPROVE; C5 uses not-yours + delivery', () => {
    expect(quotation).toContain("name: 'quote-approve'");
    expect(quotation).toContain('quoteNotYours');
    expect(quotation).toContain('getDeliveryStatus');
    expect(commerce).toContain('getDeliveryStatus');
  });
});

describe('USER_JOURNEY Sales P0 taps', () => {
  it('More, Edit Quote, Add/Edit/Remove lines, Invoice, Cancel stay command text', () => {
    const more = readFileSync('src/line/templates/quotation.ts', 'utf8');
    expect(more).toContain('QUOTE LINES');
    expect(more).toContain('QUOTE EDIT');
    expect(more).toContain('QUOTE REMOVE');
    expect(more).toContain('QUOTE ADD');
    expect(quotation).toContain("name: 'quote-invoice'");
    expect(quotation).toContain("name: 'quote-cancel'");
  });
});
