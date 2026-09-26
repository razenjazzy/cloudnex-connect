import type { Express } from 'express';
import { decodeMediaToken, fetchGcsObject } from '../line/media';
import { adminBase } from './public-bases';
import { readProductImage128, sniffImageContentType } from '../services/odoo/product-image';

export const registerMediaRoutes = (app: Express): void => {
  app.get(`${adminBase()}/catalog/product/:id/image`, async (req, res) => {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) return res.status(404).end();
    const buffer = await readProductImage128(productId);
    if (!buffer) return res.status(404).end();
    res.setHeader('content-type', sniffImageContentType(buffer));
    res.setHeader('cache-control', 'public, max-age=300');
    return res.status(200).end(buffer);
  });

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
