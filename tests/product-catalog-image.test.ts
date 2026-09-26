import { describe, expect, it } from 'vitest';
import { sniffImageContentType } from '../src/services/odoo/product-image';
import { publicCatalogProductImageUrl } from '../src/erp/product-image-url';

describe('product catalog images', () => {
  it('builds a LINE-safe URL on the Admin public path', () => {
    const previousBase = process.env.PUBLIC_BASE_URL;
    const previousAdmin = process.env.PUBLIC_ADMIN_BASE;
    process.env.PUBLIC_BASE_URL = 'https://amardhaka.io/cloudnex-connect';
    process.env.PUBLIC_ADMIN_BASE = '/admin';
    expect(publicCatalogProductImageUrl(11)).toBe(
      'https://amardhaka.io/cloudnex-connect/admin/catalog/product/11/image',
    );
    expect(publicCatalogProductImageUrl(0)).toBeUndefined();
    if (previousBase === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousBase;
    if (previousAdmin === undefined) delete process.env.PUBLIC_ADMIN_BASE;
    else process.env.PUBLIC_ADMIN_BASE = previousAdmin;
  });

  it('sniffs jpeg and png bytes', () => {
    expect(sniffImageContentType(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(sniffImageContentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
  });
});
