import { describe, expect, it } from 'vitest';
import type { messagingApi } from '@line/bot-sdk';
import { ensureNextWindowOrHome, hasNextInputWindow, isHomeFlex } from '../src/line/journey-continue';
import { LINE_LIMITS } from '../src/line/message-limits';

const homeFlex = (): messagingApi.FlexMessage => ({
  type: 'flex',
  altText: 'CloudNex Connect: Sora menu',
  contents: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
});

const doneCard = (actions?: { type: 'message'; text: string }[]): messagingApi.FlexMessage => ({
  type: 'flex',
  altText: 'Done: verified',
  contents: {
    type: 'bubble',
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: (actions || [{ type: 'message', text: 'NAV HOME' }]).map(action => ({
        type: 'button',
        action,
      })),
    },
  },
});

const ctx = (text: string, pendingFlow?: { flow: string }) => ({
  text,
  profile: pendingFlow ? { pendingFlow } : {},
});

describe('ensureNextWindowOrHome', () => {
  it('appends Home after verified Done that only has a Home button', () => {
    const messages = ensureNextWindowOrHome(ctx('FORM VERIFY'), [doneCard()], homeFlex);
    expect(messages).toHaveLength(2);
    expect(isHomeFlex(messages[1])).toBe(true);
  });

  it('does not append Home when OTP fail has retry actions', () => {
    const fail = doneCard([{ type: 'message', text: 'VERIFY START 0812345678' }]);
    expect(hasNextInputWindow([fail])).toBe(true);
    const messages = ensureNextWindowOrHome(ctx('VERIFY OTP 000000'), [fail], homeFlex);
    expect(messages).toHaveLength(1);
  });

  it('does not append Home while a guided form is still open', () => {
    const messages = ensureNextWindowOrHome(
      ctx('Alice', { flow: 'QUOTE_CREATE' }),
      [doneCard()],
      homeFlex,
    );
    expect(messages).toHaveLength(1);
  });

  it('does not append Home on NAV commerce', () => {
    const messages = ensureNextWindowOrHome(ctx('NAV commerce'), [doneCard()], homeFlex);
    expect(messages).toHaveLength(1);
  });

  it('does not append Home when a catalog carousel is the next window', () => {
    const carousel: messagingApi.FlexMessage = {
      type: 'flex',
      altText: '2 products',
      contents: { type: 'carousel', contents: [{ type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } }] },
    };
    expect(hasNextInputWindow([carousel])).toBe(true);
    expect(ensureNextWindowOrHome(ctx('PRODUCT FIND'), [carousel], homeFlex)).toHaveLength(1);
  });

  it('does not append catalog Home after Product Details', () => {
    const details: messagingApi.FlexMessage = {
      type: 'flex',
      altText: 'Product: App Premium',
      contents: {
        type: 'bubble',
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [{ type: 'button', action: { type: 'message', text: 'NAV HOME' } }],
        },
      },
    };
    expect(ensureNextWindowOrHome(ctx('PRODUCT FIND id:11'), [details], homeFlex)).toHaveLength(1);
  });

  it('does not exceed the LINE 5-message cap', () => {
    const five = Array.from({ length: LINE_LIMITS.MAX_MESSAGES_PER_REPLY }, () => doneCard());
    expect(ensureNextWindowOrHome(ctx('LANG EN'), five, homeFlex)).toHaveLength(5);
  });

  it('does not double Home when Home Flex is already present', () => {
    const messages = ensureNextWindowOrHome(ctx('VERIFY OTP 123456'), [doneCard(), homeFlex()], homeFlex);
    expect(messages.filter(isHomeFlex)).toHaveLength(1);
  });
});

describe('isProductDetailFlex', () => {
  it('detects Product Details bubbles and ignores catalogue carousels', async () => {
    const { isProductDetailFlex } = await import('../src/line/journey-continue');
    expect(isProductDetailFlex({
      type: 'flex',
      altText: 'Product: App Premium',
      contents: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
    })).toBe(true);
    expect(isProductDetailFlex({
      type: 'flex',
      altText: '2 products',
      contents: {
        type: 'carousel',
        contents: [{
          type: 'bubble',
          footer: { type: 'box', layout: 'vertical', contents: [{ type: 'button', action: { type: 'message', text: 'FORM QUOTE CREATE FROM CARD 11' } }] },
        }],
      },
    })).toBe(false);
    expect(isProductDetailFlex({
      type: 'flex',
      altText: 'Details',
      contents: {
        type: 'bubble',
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'button', action: { type: 'message', text: 'FORM QUOTE CREATE FROM CARD 11' } },
            { type: 'button', action: { type: 'message', text: 'BACK' } },
            { type: 'button', action: { type: 'message', text: 'NAV HOME' } },
          ],
        },
      },
    })).toBe(true);
  });
});

describe('shouldPushDeferredCatalog', () => {
  it('does not push catalog after a Product Details reply even if pendingCatalogPush is set', async () => {
    const { shouldPushDeferredCatalog } = await import('../src/line/journey-continue');
    const details: messagingApi.FlexMessage = {
      type: 'flex',
      altText: 'Product: App Premium',
      contents: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
    };
    expect(shouldPushDeferredCatalog({
      pendingCatalogPush: true,
      isGroupContext: false,
      applyTray: true,
      text: 'PRODUCT FIND id:11',
      messages: [details],
    })).toBe(false);
    expect(shouldPushDeferredCatalog({
      pendingCatalogPush: true,
      isGroupContext: false,
      applyTray: true,
      text: 'NAV COMMERCE',
      messages: [details],
    })).toBe(false);
    expect(shouldPushDeferredCatalog({
      pendingCatalogPush: true,
      isGroupContext: false,
      applyTray: true,
      text: 'NAV HOME',
      messages: [{ type: 'flex', altText: 'CloudNex Connect: Sora menu', contents: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } } }],
    })).toBe(true);
    expect(shouldPushDeferredCatalog({
      pendingCatalogPush: true,
      isGroupContext: true,
      applyTray: true,
      text: 'NAV HOME',
      messages: [{ type: 'flex', altText: 'CloudNex Connect: Sora menu', contents: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } } }],
    })).toBe(false);
  });
});
