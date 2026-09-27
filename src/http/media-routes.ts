import type { Express, Request, Response } from 'express';
import { decodeMediaToken, fetchGcsObject } from '../line/media';
import { adminBase, catalogPublicPath } from './public-bases';
import { readProductImage128, sniffImageContentType } from '../services/odoo/product-image';

const sendCatalogProductImage = async (req: Request, res: Response) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) return res.status(404).end();
  const buffer = await readProductImage128(productId);
  if (!buffer) return res.status(404).end();
  res.setHeader('content-type', sniffImageContentType(buffer));
  res.setHeader('content-length', String(buffer.length));
  res.setHeader('cache-control', 'public, max-age=300');
  return res.status(200).send(buffer);
};

export const registerMediaRoutes = (app: Express): void => {
  const imagePaths = new Set([
    `${catalogPublicPath()}/product/:id/image`,
    `${adminBase()}/catalog/product/:id/image`,
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
