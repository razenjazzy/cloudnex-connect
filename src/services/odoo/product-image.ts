import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeKwRead, getOdooConfig, loginRead } from './client';

const CACHE_MS = Number(process.env.PRODUCT_IMAGE_CACHE_MS || 5 * 60 * 1000);
const cache = new Map<number, { at: number; buffer: Buffer | null }>();

export const resetProductImageCacheForTests = (): void => {
  cache.clear();
};

const asBuffer = (raw: unknown): Buffer | null => {
  if (Buffer.isBuffer(raw) && raw.length >= 32) return raw;
  if (raw instanceof Uint8Array && raw.length >= 32) return Buffer.from(raw);
  if (typeof raw !== 'string' || raw.length < 32) return null;
  try {
    const buffer = Buffer.from(raw, 'base64');
    return buffer.length >= 32 ? buffer : null;
  } catch {
    return null;
  }
};

// Hero images: 256 px is sharp on a LINE card and stays well under LINE's 1 MB hero cap once WebP -> PNG;
// 128 px is the fallback for photos whose 256 px PNG is too heavy. Larger sizes are never fetched.
const IMAGE_FIELDS = ['image_256', 'image_128'] as const;
const HERO_MAX_BYTES = 900_000;

const readImageFields = async (
  uid: number,
  model: 'product.product' | 'product.template',
  id: number,
): Promise<Buffer[]> => {
  const config = getOdooConfig();
  if (!config) return [];
  const rows = await executeKwRead<Record<string, unknown>[]>(
    config,
    uid,
    model,
    'search_read',
    [[['id', '=', id]]],
    { fields: [...IMAGE_FIELDS], limit: 1 },
  );
  const row = rows[0];
  if (!row) return [];
  return IMAGE_FIELDS.map(field => asBuffer(row[field])).filter((buffer): buffer is Buffer => Boolean(buffer));
};

/** First candidate (largest first) that converts to a LINE-safe image under the hero size cap. */
export const pickHeroImage = (
  candidates: Buffer[],
  convert: (buffer: Buffer) => Buffer | null = toLineSafeImage,
  maxBytes = HERO_MAX_BYTES,
): Buffer | null => {
  for (const candidate of candidates) {
    const safe = convert(candidate);
    if (safe && safe.length <= maxBytes) return safe;
  }
  return null;
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
    let candidates = await readImageFields(uid, 'product.product', productId);
    if (!candidates.length) {
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
        candidates = await readImageFields(uid, 'product.template', tmplId);
      }
    }
    const safe = pickHeroImage(candidates);
    cache.set(productId, { at: Date.now(), buffer: safe });
    return safe;
  } catch {
    cache.set(productId, { at: Date.now(), buffer: null });
    return null;
  }
};

/**
 * Ids whose variant or template carries a photo — no binary download.
 *
 * Odoo cannot search the computed `image_128/256/512/1920` fields on
 * `product.product` (the RPC raises a Server Error), and a silent catch
 * here used to turn that into "no product has a photo", so every card
 * showed the camera placeholder. Variants are checked through the stored
 * `image_variant_1920`; templates accept `image_128` searches.
 */
export const productIdsWithImage128 = async (productIds: number[]): Promise<Set<number>> => {
  const ids = [...new Set(productIds.filter(id => Number.isInteger(id) && id > 0))];
  if (!ids.length) return new Set();
  const config = getOdooConfig();
  if (!config) return new Set();
  try {
    const uid = await loginRead(config);
    if (!uid) return new Set();
    const variants = await executeKwRead<{ id: number; product_tmpl_id?: unknown }[]>(
      config,
      uid,
      'product.product',
      'search_read',
      [[['id', 'in', ids]]],
      { fields: ['id', 'product_tmpl_id'], limit: ids.length },
    );
    const withVariantPhoto = await executeKwRead<{ id: number }[]>(
      config,
      uid,
      'product.product',
      'search_read',
      [[['id', 'in', ids], ['image_variant_1920', '!=', false]]],
      { fields: ['id'], limit: ids.length },
    );
    const found = new Set((withVariantPhoto || []).map(row => Number(row.id)).filter(id => id > 0));

    const tmplByProduct = new Map<number, number>();
    for (const row of variants || []) {
      const tmpl = row.product_tmpl_id;
      const tmplId = Array.isArray(tmpl) ? Number(tmpl[0]) : Number(tmpl);
      if (Number.isInteger(tmplId) && tmplId > 0) tmplByProduct.set(Number(row.id), tmplId);
    }
    const tmplIds = [...new Set(tmplByProduct.values())];
    if (!tmplIds.length) return found;
    const tmplHits = await executeKwRead<{ id: number }[]>(
      config,
      uid,
      'product.template',
      'search_read',
      [[['id', 'in', tmplIds], ['image_128', '!=', false]]],
      { fields: ['id'], limit: tmplIds.length },
    );
    const tmplWithImage = new Set((tmplHits || []).map(row => Number(row.id)));
    for (const [productId, tmplId] of tmplByProduct) {
      if (tmplWithImage.has(tmplId)) found.add(productId);
    }
    return found;
  } catch (error) {
    console.warn('productIdsWithImage128 failed; cards fall back to the placeholder image:', error);
    return new Set();
  }
};

export const sniffImageContentType = (buffer: Buffer): string => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (isWebp(buffer)) return 'image/webp';
  return 'image/jpeg';
};

const isJpeg = (buffer: Buffer): boolean =>
  buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

const isPng = (buffer: Buffer): boolean =>
  buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;

const isWebp = (buffer: Buffer): boolean =>
  buffer.length >= 12
  && buffer.toString('ascii', 0, 4) === 'RIFF'
  && buffer.toString('ascii', 8, 12) === 'WEBP';

/** LINE Flex heroes accept JPEG/PNG only. Odoo 16+ stores WebP. */
export const toLineSafeImage = (buffer: Buffer): Buffer | null => {
  if (!buffer || buffer.length < 32) return null;
  if (isJpeg(buffer) || isPng(buffer)) return buffer;
  if (!isWebp(buffer)) return null;
  const dir = mkdtempSync(join(tmpdir(), 'cns-webp-'));
  try {
    const inFile = join(dir, 'in.webp');
    const outFile = join(dir, 'out.png');
    writeFileSync(inFile, buffer);
    const converted = spawnSync('dwebp', [inFile, '-o', outFile], { timeout: 4000 });
    if (converted.status !== 0) return null;
    const png = readFileSync(outFile);
    return isPng(png) ? png : null;
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
