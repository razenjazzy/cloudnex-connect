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
  return `${host.origin}${host.path}/product/${productId}/image?v=png`;
};

/** Camera / no-photo hero when the product has no usable photo. */
export const publicCatalogPlaceholderImageUrl = (): string | undefined => {
  const host = httpsCatalogOrigin();
  if (!host) return undefined;
  return `${host.origin}${host.path}/product/placeholder/image`;
};

/** Proven HTTPS photo, else the public /product/{id}/image URL, else the camera / no-photo PNG. */
export const catalogProductHeroUrl = (productId?: number, imageUrl?: string): string | undefined => {
  const proven = imageUrl?.trim();
  if (proven?.startsWith('https://') && !proven.includes('/product/placeholder/image')) return proven;
  if (productId && Number.isInteger(productId) && productId > 0) {
    const fromId = publicCatalogProductImageUrl(productId);
    if (fromId) return fromId;
  }
  return publicCatalogPlaceholderImageUrl();
};
