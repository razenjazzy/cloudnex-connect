import type { Express } from 'express';
import { decodeMediaToken, fetchGcsObject } from '../line/media';

export const registerMediaRoutes = (app: Express): void => {
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
