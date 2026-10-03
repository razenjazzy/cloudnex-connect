import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOdooConfig, loginRead } from '../src/services/odoo/client';
import { readProductImage128, resetProductImageCacheForTests } from '../src/services/odoo/product-image';

vi.mock('../src/services/odoo/client', () => ({
  getOdooConfig: vi.fn(() => ({ url: 'http://odoo.test', db: 'db', username: 'u', apiKey: 'k' })),
  loginRead: vi.fn(async () => 0),
  executeKwRead: vi.fn(),
}));

describe('product image miss cache', () => {
  beforeEach(() => {
    resetProductImageCacheForTests();
    vi.mocked(getOdooConfig).mockReturnValue({ url: 'http://odoo.test', db: 'db', username: 'u', apiKey: 'k' });
    vi.mocked(loginRead).mockReset();
    vi.mocked(loginRead).mockResolvedValue(0);
  });

  it('caches a failed Odoo login so LINE retries do not login again', async () => {
    await expect(readProductImage128(2)).resolves.toBeNull();
    await expect(readProductImage128(2)).resolves.toBeNull();
    expect(loginRead).toHaveBeenCalledTimes(1);
  });

  it('caches a thrown Odoo read so LINE retries do not hit Odoo again', async () => {
    vi.mocked(loginRead).mockRejectedValue(new Error('odoo down'));
    await expect(readProductImage128(3)).resolves.toBeNull();
    await expect(readProductImage128(3)).resolves.toBeNull();
    expect(loginRead).toHaveBeenCalledTimes(1);
  });
});
