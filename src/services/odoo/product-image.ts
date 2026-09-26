import { executeKwRead, getOdooConfig, loginRead } from './client';

const CACHE_MS = Number(process.env.PRODUCT_IMAGE_CACHE_MS || 5 * 60 * 1000);
const cache = new Map<number, { at: number; buffer: Buffer | null }>();

const asBuffer = (raw: unknown): Buffer | null => {
  if (typeof raw !== 'string' || raw.length < 32) return null;
  try {
    const buffer = Buffer.from(raw, 'base64');
    return buffer.length >= 32 ? buffer : null;
  } catch {
    return null;
  }
};

const readImageField = async (
  uid: number,
  model: 'product.product' | 'product.template',
  id: number,
): Promise<Buffer | null> => {
  const config = getOdooConfig();
  if (!config) return null;
  const rows = await executeKwRead<Record<string, unknown>[]>(
    config,
    uid,
    model,
    'search_read',
    [[['id', '=', id]]],
    { fields: ['image_128'], limit: 1 },
  );
  return asBuffer(rows[0]?.image_128);
};

export const readProductImage128 = async (productId: number): Promise<Buffer | null> => {
  if (!Number.isInteger(productId) || productId <= 0) return null;
  const hit = cache.get(productId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.buffer;

  const config = getOdooConfig();
  if (!config) {
    cache.set(productId, { at: Date.now(), buffer: null });
    return null;
  }
  try {
    const uid = await loginRead(config);
    if (!uid) {
      cache.set(productId, { at: Date.now(), buffer: null });
      return null;
    }
    let buffer = await readImageField(uid, 'product.product', productId);
    if (!buffer) {
      const rows = await executeKwRead<Record<string, unknown>[]>(
        config,
        uid,
        'product.product',
        'search_read',
        [[['id', '=', productId]]],
        { fields: ['product_tmpl_id'], limit: 1 },
      );
      const tmpl = rows[0]?.product_tmpl_id;
      const tmplId = Array.isArray(tmpl) ? Number(tmpl[0]) : Number(tmpl);
      if (Number.isInteger(tmplId) && tmplId > 0) {
        buffer = await readImageField(uid, 'product.template', tmplId);
      }
    }
    cache.set(productId, { at: Date.now(), buffer });
    return buffer;
  } catch {
    cache.set(productId, { at: Date.now(), buffer: null });
    return null;
  }
};

export const sniffImageContentType = (buffer: Buffer): string => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  return 'image/jpeg';
};
