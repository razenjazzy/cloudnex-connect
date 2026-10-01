import type { Express, Request, Response } from 'express';
import { decodeMediaToken, fetchGcsObject } from '../line/media';
import { adminBase, catalogPublicPath } from './public-bases';
import { CATALOG_PLACEHOLDER_PNG } from './catalog-placeholder';
import { readProductImage128, sniffImageContentType } from '../services/odoo/product-image';

const sendCatalogPlaceholderImage = (_req: Request, res: Response) => {
  res.setHeader('content-type', 'image/png');
  res.setHeader('content-length', String(CATALOG_PLACEHOLDER_PNG.length));
  res.setHeader('cache-control', 'public, max-age=86400');
  return res.status(200).send(CATALOG_PLACEHOLDER_PNG);
};

const sendCatalogProductImage = async (req: Request, res: Response) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) return res.status(404).end();
  const buffer = await readProductImage128(productId);
  if (!buffer) return sendCatalogPlaceholderImage(req, res);
  res.setHeader('content-type', sniffImageContentType(buffer));
  res.setHeader('content-length', String(buffer.length));
  res.setHeader('cache-control', 'public, max-age=300');
  return res.status(200).send(buffer);
};

export const registerMediaRoutes = (app: Express): void => {
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
