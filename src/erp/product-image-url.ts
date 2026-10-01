import { catalogPublicPath, originFromPublicBaseUrl } from '../http/public-bases';
import { getRuntime } from '../services/runtime-settings';

const httpsCatalogOrigin = (): { origin: string; path: string } | undefined => {
  const base = getRuntime('PUBLIC_BASE_URL') || process.env.PUBLIC_BASE_URL;
  const origin = originFromPublicBaseUrl(base);
  if (!origin.startsWith('https://')) return undefined;
  return { origin, path: catalogPublicPath(base) };
};

/** LINE-fetchable HTTPS URL. Odoo `/web/image` is session-gated and LINE drops the whole Flex reply. */
export const publicCatalogProductImageUrl = (productId: number): string | undefined => {
  if (!Number.isInteger(productId) || productId <= 0) return undefined;
  const host = httpsCatalogOrigin();
  if (!host) return undefined;
  return `${host.origin}${host.path}/product/${productId}/image`;
};

/** Camera / no-photo hero when the product has no image_128. */
export const publicCatalogPlaceholderImageUrl = (): string | undefined => {
  const host = httpsCatalogOrigin();
  if (!host) return undefined;
  return `${host.origin}${host.path}/product/placeholder/image`;
};

/** Proven HTTPS image when Odoo has bytes; otherwise the camera placeholder (do not hit Odoo on the Flex hero). */
export const catalogProductHeroUrl = (productId?: number, imageUrl?: string): string | undefined => {
  const proven = imageUrl?.trim();
  if (proven?.startsWith('https://')) return proven;
  const placeholder = publicCatalogPlaceholderImageUrl();
  if (placeholder) return placeholder;
  return productId && Number.isInteger(productId) && productId > 0
    ? publicCatalogProductImageUrl(productId)
    : undefined;
};
