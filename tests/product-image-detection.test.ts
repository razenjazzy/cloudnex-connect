import { describe, expect, it, vi, beforeEach } from 'vitest';

const { executeKwRead } = vi.hoisted(() => ({ executeKwRead: vi.fn() }));
vi.mock('../src/services/odoo/client', () => ({
  getOdooConfig: () => ({ url: 'https://odoo.test', db: 'db', username: 'u', apiKey: 'k' }),
  loginRead: async () => 1,
  executeKwRead,
}));

import { productIdsWithImage128 } from '../src/services/odoo/product-image';

describe('productIdsWithImage128', () => {
  beforeEach(() => { executeKwRead.mockReset(); });

  it('finds photos on the template and never searches computed image fields on product.product', async () => {
    executeKwRead.mockImplementation(async (...call: unknown[]) => {
      const model = call[2] as string;
      const domain = JSON.stringify((call[4] as unknown[])[0]);
      if (model === 'product.product' && /image_(128|256|512|1920)"/.test(domain)) {
        throw new Error('Odoo RPC error: Odoo Server Error');
      }
      if (model === 'product.product' && domain.includes('image_variant_1920')) return [];
      if (model === 'product.product') return [{ id: 2, product_tmpl_id: [3, 'A'] }, { id: 13, product_tmpl_id: [9, 'B'] }];
      if (model === 'product.template') return [{ id: 3 }];
      return [];
    });
    const found = await productIdsWithImage128([2, 13]);
    expect([...found]).toEqual([2]);
  });

  it('returns an empty set (and does not throw) when Odoo fails', async () => {
    executeKwRead.mockImplementation(async () => { throw new Error('boom'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await productIdsWithImage128([2])).size).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

import { pickHeroImage } from '../src/services/odoo/product-image';

describe('hero image choice', () => {
  const big = Buffer.alloc(1_200_000, 1);
  const small = Buffer.alloc(100_000, 2);
  const convert = (buffer: Buffer) => buffer;

  it('prefers the sharper 256 px image', () => {
    expect(pickHeroImage([small, Buffer.alloc(50_000, 3)], convert)).toBe(small);
  });

  it('falls back to 128 px when the 256 px PNG is over the hero size cap', () => {
    const fallback = Buffer.alloc(60_000, 4);
    expect(pickHeroImage([big, fallback], convert)).toBe(fallback);
  });

  it('returns null when nothing converts', () => {
    expect(pickHeroImage([small], () => null)).toBeNull();
    expect(pickHeroImage([], convert)).toBeNull();
  });
});
