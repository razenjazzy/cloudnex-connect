import type { Express, Request, Response } from 'express';
import { decodeMediaToken, fetchGcsObject } from '../line/media';
import { adminBase, catalogPublicPath } from './public-bases';
import { CATALOG_PLACEHOLDER_PNG } from './catalog-placeholder';
import { readProductImage128, sniffImageContentType } from '../services/odoo/product-image';

const sendPlaceholder = (res: Response, maxAge: number) => {
  res.setHeader('content-type', 'image/png');
  res.setHeader('content-length', String(CATALOG_PLACEHOLDER_PNG.length));
  res.setHeader('cache-control', `public, max-age=${maxAge}`);
  res.setHeader('cross-origin-resource-policy', 'cross-origin');
  return res.status(200).send(CATALOG_PLACEHOLDER_PNG);
};

const sendCatalogPlaceholderImage = (_req: Request, res: Response) => sendPlaceholder(res, 86400);

const sendCatalogProductImage = async (req: Request, res: Response) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) return sendPlaceholder(res, 60);
  const IMAGE_FETCH_MS = 8000;
  const buffer = await Promise.race([
    readProductImage128(productId),
    new Promise<null>(resolve => setTimeout(() => resolve(null), IMAGE_FETCH_MS)),
  ]);
  if (!buffer || buffer.length < 32) return sendPlaceholder(res, 60);
  res.setHeader('content-type', sniffImageContentType(buffer));
  res.setHeader('content-length', String(buffer.length));
  res.setHeader('cache-control', 'public, max-age=300');
  res.setHeader('cross-origin-resource-policy', 'cross-origin');
  return res.status(200).send(buffer);
};

const catalogImageFromPath = (req: Request, res: Response, next: () => void) => {
  const path = req.path.replace(/\/+$/, '');
  if (/\/product\/placeholder\/image$/.test(path)) return sendCatalogPlaceholderImage(req, res);
  const hit = path.match(/\/product\/(\d+)\/image$/);
  if (hit) {
    req.params.id = hit[1];
    return sendCatalogProductImage(req, res);
  }
  return next();
};

export const registerMediaRoutes = (app: Express): void => {
  app.get(/\/catalog(?:\/.*)?\/product\/(?:placeholder|\d+)\/image\/?$/, catalogImageFromPath);
  const placeholderPaths = new Set([
    `${catalogPublicPath()}/product/placeholder/image`,
    `${adminBase()}/catalog/product/placeholder/image`,
    '/catalog/product/placeholder/image',
    '/cloudnex-connect/catalog/product/placeholder/image',
    '/cloudnex-connect/catalog/test/product/placeholder/image',
  ]);
  for (const path of placeholderPaths) {
    app.get(path, sendCatalogPlaceholderImage);
  }
  const imagePaths = new Set([
    `${catalogPublicPath()}/product/:id/image`,
    `${adminBase()}/catalog/product/:id/image`,
    '/catalog/product/:id/image',
    '/cloudnex-connect/catalog/product/:id/image',
    '/cloudnex-connect/catalog/test/product/:id/image',
  ]);
  for (const path of imagePaths) {
    app.get(path, sendCatalogProductImage);
  }

  app.get('/media/:token', async (req, res) => {
    const token = String(req.params.token || '');
    const decoded = decodeMediaToken(token);
    if (!decoded) return res.status(404).json({ error: 'Not found.' });
    const object = await fetchGcsObject(decoded.objectName);
    if (!object) return res.status(404).json({ error: 'Not found.' });
    res.setHeader('content-type', object.contentType);
    res.setHeader('cache-control', 'private, max-age=60');
    return res.status(200).end(object.buffer);
  });
};
