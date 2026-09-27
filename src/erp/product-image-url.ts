import { catalogPublicPath, originFromPublicBaseUrl } from '../http/public-bases';
import { getRuntime } from '../services/runtime-settings';

/** LINE-fetchable HTTPS URL. Odoo `/web/image` is session-gated and LINE drops the whole Flex reply. */
export const publicCatalogProductImageUrl = (productId: number): string | undefined => {
  if (!Number.isInteger(productId) || productId <= 0) return undefined;
  const base = getRuntime('PUBLIC_BASE_URL') || process.env.PUBLIC_BASE_URL;
  const origin = originFromPublicBaseUrl(base);
  if (!origin.startsWith('https://')) return undefined;
  return `${origin}${catalogPublicPath(base)}/product/${productId}/image`;
};

/** One Flex hero URL for catalogue, Product Details, Sales OA, and Customer OA. */
export const catalogProductHeroUrl = (productId?: number, imageUrl?: string): string | undefined => {
  const canonical = productId && Number.isInteger(productId) && productId > 0
    ? publicCatalogProductImageUrl(productId)
    : undefined;
  if (canonical) return canonical;
  const fallback = imageUrl?.trim();
  return fallback?.startsWith('https://') ? fallback : undefined;
};
