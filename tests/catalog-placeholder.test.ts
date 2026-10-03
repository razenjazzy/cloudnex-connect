import { inflateSync } from 'zlib';
import { describe, expect, it } from 'vitest';
import { CATALOG_PLACEHOLDER_PNG, isValidPng } from '../src/http/catalog-placeholder';

describe('catalog placeholder PNG', () => {
  it('is a fully decodable 400x260 PNG (not a corrupt blank)', () => {
    expect(isValidPng(CATALOG_PLACEHOLDER_PNG, 400, 260)).toBe(true);
    expect(CATALOG_PLACEHOLDER_PNG.length).toBeLessThan(1_000_000);
  });

  it('draws a camera, not a single flat colour', () => {
    const idat: Buffer[] = [];
    let offset = 8;
    while (offset + 12 <= CATALOG_PLACEHOLDER_PNG.length) {
      const length = CATALOG_PLACEHOLDER_PNG.readUInt32BE(offset);
      if (CATALOG_PLACEHOLDER_PNG.subarray(offset + 4, offset + 8).toString() === 'IDAT') {
        idat.push(CATALOG_PLACEHOLDER_PNG.subarray(offset + 8, offset + 8 + length));
      }
      offset += 12 + length;
    }
    const raw = inflateSync(Buffer.concat(idat));
    expect(new Set(raw).size).toBeGreaterThan(8);
  });

  it('rejects a corrupted copy', () => {
    const bad = Buffer.from(CATALOG_PLACEHOLDER_PNG);
    bad[bad.length - 40] ^= 0xff;
    expect(isValidPng(bad, 400, 260)).toBe(false);
  });
});
