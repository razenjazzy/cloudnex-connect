import { describe, expect, it } from 'vitest';
import { createSalesAccountFlexMessage } from '../src/line/templates';

describe('Sales OA account card', () => {
  it('shows who is signed in, role, session end, and the Verify / Sign out buttons', () => {
    const expires = new Date(Date.now() + 5 * 3600_000).toISOString();
    const card = JSON.stringify(createSalesAccountFlexMessage({ name: 'Anna Seller', phone: '0812345678', roleKey: 'sales_manager', expiresAt: expires, idle: '30 min' }, 'en'));
    expect(card).toContain('Anna Seller');
    expect(card).toContain('Sales Administrator');
    expect(card).toContain('Signed in');
    expect(card).toContain('Session until');
    expect(card).toContain('Signs out after 30 min idle');
    expect(card).toContain('"text":"FORM VERIFY"');
    expect(card).toContain('"text":"VERIFY SIGNOUT"');
  });

  it('keeps button labels within the LINE 20-character limit in both languages', () => {
    for (const language of ['en', 'th'] as const) {
      const card = createSalesAccountFlexMessage({ name: 'A', roleKey: 'admin' }, language);
      const labels = [...JSON.stringify(card).matchAll(/"label":"([^"]*)"/g)].map(match => match[1]);
      expect(labels.length).toBe(2);
      for (const label of labels) expect([...label].length).toBeLessThanOrEqual(20);
    }
  });
});
