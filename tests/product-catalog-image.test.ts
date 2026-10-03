import { describe, expect, it } from 'vitest';
import { sniffImageContentType } from '../src/services/odoo/product-image';
import { catalogProductHeroUrl, publicCatalogPlaceholderImageUrl, publicCatalogProductImageUrl } from '../src/erp/product-image-url';

describe('product catalog images', () => {
  it('builds a LINE-safe URL on the public catalog path, not Admin', () => {
    const previousBase = process.env.PUBLIC_BASE_URL;
    const previousAdmin = process.env.PUBLIC_ADMIN_BASE;
    process.env.PUBLIC_BASE_URL = 'https://amardhaka.io/cloudnex-connect';
    process.env.PUBLIC_ADMIN_BASE = '/admin';
    expect(publicCatalogProductImageUrl(11)).toBe(
      'https://amardhaka.io/cloudnex-connect/catalog/product/11/image?v=png',
    );
    process.env.PUBLIC_ADMIN_BASE = '/admin/test';
    expect(publicCatalogProductImageUrl(11)).toBe(
      'https://amardhaka.io/cloudnex-connect/catalog/test/product/11/image?v=png',
    );
    expect(publicCatalogProductImageUrl(0)).toBeUndefined();
    expect(catalogProductHeroUrl(11)).toBe(
      'https://amardhaka.io/cloudnex-connect/catalog/test/product/11/image?v=png',
    );
    expect(catalogProductHeroUrl(11, 'https://example.com/other.png')).toBe(
      'https://example.com/other.png',
    );
    expect(catalogProductHeroUrl()).toBe(
      'https://amardhaka.io/cloudnex-connect/catalog/test/product/placeholder/image?v=2',
    );
    expect(publicCatalogPlaceholderImageUrl()).toBe(
      'https://amardhaka.io/cloudnex-connect/catalog/test/product/placeholder/image?v=2',
    );
    if (previousBase === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousBase;
    if (previousAdmin === undefined) delete process.env.PUBLIC_ADMIN_BASE;
    else process.env.PUBLIC_ADMIN_BASE = previousAdmin;
  });

  it('registers Flex image aliases that nginx may hit without the Admin /test suffix', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/http/media-routes.ts', 'utf8');
    expect(src).toContain('/catalog/product/:id/image');
    expect(src).toContain('/cloudnex-connect/catalog/product/:id/image');
    expect(src).toContain('/cloudnex-connect/catalog/test/product/:id/image');
    expect(src).toContain('/product/placeholder/image');
    expect(src).toContain('sendCatalogPlaceholderImage');
    expect(src).toContain('catalogImageFromPath');
    expect(readFileSync('Dockerfile', 'utf8')).toContain('libwebp-tools');
    expect(readFileSync('src/line/handlers/service-catalog-handler.ts', 'utf8')).toContain(
      'catalogProductHeroUrl(item.imageUrl ? item.id : undefined, item.imageUrl)',
    );
  });

  it('sniffs jpeg and png bytes', () => {
    expect(sniffImageContentType(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(sniffImageContentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    const webp = Buffer.alloc(16);
    webp.write('RIFF', 0);
    webp.write('WEBP', 8);
    expect(sniffImageContentType(webp)).toBe('image/webp');
  });
});
