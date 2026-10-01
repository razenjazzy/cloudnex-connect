/** Shop-style URL fragment shown under the product name (e.g. App Premium → app-premium). */
export const catalogContextSlug = (product: { sku?: string; name?: string; websiteUrl?: string }): string => {
  const fromPath = pathSlug(product.websiteUrl);
  if (fromPath) return fromPath;
  const fromSku = slugify(product.sku);
  if (fromSku) return fromSku;
  return slugify(product.name) || 'product';
};

const pathSlug = (raw?: string): string | undefined => {
  const value = (raw || '').trim();
  if (!value) return undefined;
  let path = value;
  try {
    if (/^https?:\/\//i.test(value)) path = new URL(value).pathname;
  } catch {
    return undefined;
  }
  const last = path.split('/').filter(Boolean).pop() || '';
  return slugify(last) || undefined;
};

const slugify = (value?: string): string => {
  const slug = (value || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, 48);
};
