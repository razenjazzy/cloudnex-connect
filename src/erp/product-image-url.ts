import { adminPublicPath, originFromPublicBaseUrl } from '../http/public-bases';
import { getRuntime } from '../services/runtime-settings';

/** LINE-fetchable HTTPS URL. Odoo `/web/image` is session-gated and LINE drops the whole Flex reply. */
export const publicCatalogProductImageUrl = (productId: number): string | undefined => {
  if (!Number.isInteger(productId) || productId <= 0) return undefined;
  const base = getRuntime('PUBLIC_BASE_URL') || process.env.PUBLIC_BASE_URL;
  const origin = originFromPublicBaseUrl(base);
  if (!origin.startsWith('https://')) return undefined;
  return `${origin}${adminPublicPath(base)}/catalog/product/${productId}/image`;
};
