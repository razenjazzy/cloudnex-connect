import path from 'node:path';
import fs from 'node:fs';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { getErpAdapter } from '../erp/registry';
import { isOdooConfigured } from '../services/odoo';
import { recordAuditEvent } from '../services/firestore';
import { getOpsBearerOrHeaderToken, isOpsTokenConfigured, isValidOpsToken } from '../services/ops-token-auth';
import { jsonParser } from './middleware';
import { isDemoControlEnabled } from './env';
import { verifyIncomingDemoSession } from './demo-session';

const adminDist = path.resolve(__dirname, '../../admin/dist');
const adminIndex = path.join(adminDist, 'index.html');

const requireAdminPanelAccess = async (req: Request, res: Response, next: NextFunction) => {
  if (isOpsTokenConfigured() && isValidOpsToken(getOpsBearerOrHeaderToken(req))) {
    return next();
  }
  if (isDemoControlEnabled && req.get('cookie')) {
    const { sessionAuthenticated } = await verifyIncomingDemoSession(req);
    if (sessionAuthenticated) return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

const spaFallback = (_req: Request, res: Response) => {
  if (!fs.existsSync(adminIndex)) {
    return res.status(503).json({ error: 'Admin UI is not built.' });
  }
  return res.sendFile(adminIndex);
};

export const registerAdminPanelRoutes = (app: Express): void => {
  app.get('/admin/crm/quotes', requireAdminPanelAccess, async (req, res) => {
    if (!isOdooConfigured()) {
      return res.status(503).json({ error: 'Odoo is unavailable.' });
    }
    const list = getErpAdapter().listQuotations;
    if (!list) return res.status(503).json({ error: 'CRM quotations are not supported.' });
    const unassignedRaw = String(req.query.unassigned || '');
    const quotes = await list({
      state: typeof req.query.state === 'string' ? req.query.state : undefined,
      unassigned: /^(1|true|yes)$/i.test(unassignedRaw),
      limit: Number(req.query.limit) || 50,
    });
    return res.json({ quotes, count: quotes.length });
  });

  app.put('/admin/crm/quotes/:id', jsonParser, requireAdminPanelAccess, async (req, res) => {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Invalid quote id.' });
    }
    const raw = req.body?.salespersonUserId;
    const salespersonUserId = raw === null || raw === undefined || raw === '' ? null : Number(raw);
    if (salespersonUserId !== null && (!Number.isInteger(salespersonUserId) || salespersonUserId <= 0)) {
      return res.status(400).json({ error: 'Invalid salespersonUserId.' });
    }
    const assign = getErpAdapter().assignQuotationSalesperson;
    if (!assign) return res.status(503).json({ error: 'CRM assign is not supported.' });
    const ok = await assign(orderId, salespersonUserId);
    recordAuditEvent({
      action: 'crm_quote_assign',
      outcome: ok ? 'success' : 'failure',
      actorUserId: 'ops',
      targetId: String(orderId),
      detail: salespersonUserId == null ? 'unassign' : 'assign',
    });
    if (!ok) return res.status(503).json({ error: 'Assign failed.' });
    return res.json({ ok: true, id: orderId, salespersonUserId });
  });

  if (fs.existsSync(adminDist)) {
    app.use('/admin', express.static(adminDist, { index: false, maxAge: '1h' }));
  }

  app.get(['/admin', '/admin/', '/admin/demo', '/admin/crm'], spaFallback);
  app.get(/^\/admin\/(?!crm\/quotes).*/, spaFallback);
};
