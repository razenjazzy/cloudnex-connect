import type { Express, NextFunction, Request, Response } from 'express';
import { getErpAdapter } from '../erp/registry';
import { isOdooConfigured } from '../services/odoo';
import { getOdooConfig } from '../services/odoo/client';
import {
  findLineUserIdByPhone,
  findVerifiedUserIdByPartnerId,
  getUserProfile,
  listRecentApprovals,
  listRecentAuditEventsPage,
  listVerifiedSalesLineUserIds,
  recordAuditEvent,
  setMarketingOptIn,
  setUserLanguage,
  setUserPendingFlow,
  setUserRole,
} from '../services/firestore';
import { getOpsBearerOrHeaderToken, isOpsTokenConfigured, isValidOpsToken } from '../services/ops-token-auth';
import { isValidAdminToken } from '../services/admin-token-auth';
import { jsonParser, adminApiLimiter, adminRevealLimiter } from './middleware';
import { appEnv, isDemoControlEnabled } from './env';
import { verifyIncomingDemoSession } from './demo-session';
import { safeTokenMatch } from '../services/demo-session';
import {
  describeSettings,
  getRuntime,
  hydrateRuntimeSettings,
  ipAllowedForAdmin,
  isAdminConfigLocked,
  isBootstrapComplete,
  isSecretSettingKey,
  markBootstrapComplete,
  mergeRuntimeOverlay,
  getEffectiveAdminUserIds,
  getSecretRevealTtlSeconds,
} from '../services/runtime-settings';
import {
  buildAdminActorCookie,
  clearAdminActorCookie,
  consumeBindOtp,
  consumeRevealToken,
  issueBindOtp,
  issueRevealToken,
  isSuperAdminActor,
  parseAdminActorCookie,
} from '../services/admin-session';
import { isAuthorizedForAdminRole } from '../services/admin-authorization';
import { verifyOdooAdminAccess } from '../services/odoo/admin';
import { sendTargetedMessage } from '../line/messaging';
import { SALES_CHANNEL_ID, getChannelServiceOverride, setChannelServiceOverride } from '../line/channels';
import { describeAllFeatureToggles, ensureFeatureTogglesLoaded, replaceFeatureToggles } from '../services/feature-toggles';
import { getPricingModel, updatePricingModel } from '../services/pricing-control';
import { getDemoPlatformPayload } from '../platform/service-modules';
import { getPlatformStatus } from '../platform/status';
import { handleOdooHook } from './odoo-hook';
import { decodeAuditCursor, parseAuditLogFilters } from '../services/audit-query';
import { auditEnvParams } from './env-params';
import { runDailyReport } from '../jobs/daily-report';
import { seedOdooSampleSalesDataWithAudit } from '../services/seed-odoo';

const REVEAL_ACTIONS = new Set([
  'secret_reveal_token_issued',
  'secret_reveal_consumed',
  'secret_reveal_denied',
]);

export const requireAdminPanelAccess = async (req: Request, res: Response, next: NextFunction) => {
  if (!ipAllowedForAdmin(req.ip || req.socket.remoteAddress || '')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isOpsTokenConfigured() && isValidOpsToken(getOpsBearerOrHeaderToken(req))) {
    return next();
  }
  if (isDemoControlEnabled && req.get('cookie')) {
    const { sessionAuthenticated } = await verifyIncomingDemoSession(req);
    if (sessionAuthenticated) return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

const requireOpsStrict = async (req: Request, res: Response, next: NextFunction) => {
  if (!ipAllowedForAdmin(req.ip || req.socket.remoteAddress || '')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isOpsTokenConfigured() && isValidOpsToken(getOpsBearerOrHeaderToken(req))) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!ipAllowedForAdmin(req.ip || req.socket.remoteAddress || '')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!isOpsTokenConfigured() || !isValidOpsToken(getOpsBearerOrHeaderToken(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const actor = parseAdminActorCookie(req.get('cookie'));
  if (!actor) return res.status(403).json({ error: 'LINE bind required.' });
  const profile = await getUserProfile(actor);
  if (!isSuperAdminActor(actor, profile)) {
    return res.status(403).json({ error: 'Super admin required.' });
  }
  (req as Request & { adminActor?: string }).adminActor = actor;
  return next();
};

const redactProfile = (userId: string, profile: Awaited<ReturnType<typeof getUserProfile>>) => ({
  userId,
  language: profile.language,
  role: profile.role,
  odooVerified: profile.odooVerified,
  odooPartnerId: profile.odooPartnerId,
  phone: profile.phone,
  displayName: profile.displayName,
  salesTier: profile.salesTier,
  lastChannelId: profile.lastChannelId,
  marketingOptIn: profile.marketingOptIn,
  pendingFlow: Boolean(profile.pendingFlow),
});

const pathParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] || '') : (value || '');

const webhookTable = (base: string) => {
  const origin = base.replace(/\/$/, '') || 'https://example.invalid';
  return {
    sales: `${origin}/webhook/sales`,
    customer: `${origin}/webhook/customer`,
    default: `${origin}/webhook`,
    verifyOdoo: `${origin}/verify/odoo`,
    verifyAction: `${origin}/verify/action`,
  };
};

export const registerAdminApiRoutes = (app: Express): void => {
  app.post('/admin/api/bootstrap', jsonParser, adminApiLimiter, async (req, res) => {
    const bootstrap = process.env.CONNECT_BOOTSTRAP_TOKEN?.trim() || '';
    if (!bootstrap || bootstrap.length < 16) {
      return res.status(503).json({ error: 'CONNECT_BOOTSTRAP_TOKEN is not configured.' });
    }
    if (await isBootstrapComplete()) {
      return res.status(410).json({ error: 'Bootstrap already completed.' });
    }
    const provided = String(req.body?.token || '');
    if (!safeTokenMatch(provided, bootstrap)) {
      return res.status(401).json({ error: 'Invalid bootstrap token.' });
    }
    const patch: Record<string, string> = {};
    if (typeof req.body?.opsApiToken === 'string') patch.OPS_API_TOKEN = req.body.opsApiToken;
    if (typeof req.body?.adminUserId === 'string') patch.ADMIN_USER_ID = req.body.adminUserId;
    if (typeof req.body?.superAdminUserIds === 'string') patch.SUPER_ADMIN_USER_IDS = req.body.superAdminUserIds;
    if (typeof req.body?.publicBaseUrl === 'string') patch.PUBLIC_BASE_URL = req.body.publicBaseUrl;
    if (Object.keys(patch).length) {
      const merged = await mergeRuntimeOverlay(patch);
      if (!merged.ok && !isAdminConfigLocked()) {
        return res.status(400).json({ error: merged.error });
      }
    }
    await markBootstrapComplete();
    await recordAuditEvent({ action: 'bootstrap_complete', outcome: 'success', actorUserId: 'bootstrap' });
    return res.json({ ok: true, bootstrapComplete: true });
  });

  app.get('/admin/api/settings', adminApiLimiter, requireAdminPanelAccess, async (_req, res) => {
    await hydrateRuntimeSettings();
    const base = getRuntime('PUBLIC_BASE_URL');
    const envAudit = auditEnvParams(appEnv);
    const adapter = getErpAdapter();
    return res.json({
      lock: isAdminConfigLocked(),
      revealTtlSeconds: getSecretRevealTtlSeconds(),
      bootstrapComplete: await isBootstrapComplete(),
      webhooks: webhookTable(base),
      settings: describeSettings(),
      missingRequired: envAudit.missingRequired,
      capabilities: adapter.capabilities,
      modules: getDemoPlatformPayload(),
    });
  });

  app.put('/admin/api/secrets', jsonParser, adminApiLimiter, requireOpsStrict, async (req, res) => {
    const patch = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (typeof value === 'string') next[key] = value;
    }
    const result = await mergeRuntimeOverlay(next);
    await recordAuditEvent({
      action: 'secrets_update',
      outcome: result.ok ? 'success' : 'failure',
      actorUserId: 'ops',
      detail: Object.keys(next).join(','),
    });
    if (!result.ok) return res.status(403).json({ error: result.error });
    return res.json({ ok: true, keys: Object.keys(next) });
  });

  app.post('/admin/api/session/bind', jsonParser, adminApiLimiter, requireOpsStrict, async (req, res) => {
    const userId = String(req.body?.lineUserId || '').trim();
    if (!userId) return res.status(400).json({ error: 'lineUserId is required.' });
    const profile = await getUserProfile(userId);
    if (!isSuperAdminActor(userId, profile)) {
      await recordAuditEvent({ action: 'admin_session_bind', outcome: 'failure', actorUserId: userId, detail: 'not_allowlisted' });
      return res.status(403).json({ error: 'Not authorized to bind.' });
    }
    const issued = await issueBindOtp(userId);
    if (!issued.ok) return res.status(503).json({ error: issued.error });
    await sendTargetedMessage([userId], `Cloudnex Connect Admin login code: ${issued.otp}`, SALES_CHANNEL_ID);
    await recordAuditEvent({ action: 'admin_session_bind', outcome: 'success', actorUserId: userId, detail: 'otp_issued' });
    return res.json({ ok: true, expiresInSec: issued.expiresInSec });
  });

  app.post('/admin/api/session/confirm', jsonParser, adminApiLimiter, requireOpsStrict, async (req, res) => {
    const userId = String(req.body?.lineUserId || '').trim();
    const otp = String(req.body?.otp || '').trim();
    if (!userId || !otp) return res.status(400).json({ error: 'lineUserId and otp are required.' });
    const ok = await consumeBindOtp(userId, otp);
    if (!ok) {
      await recordAuditEvent({ action: 'admin_session_bind', outcome: 'failure', actorUserId: userId, detail: 'otp_invalid' });
      return res.status(401).json({ error: 'Invalid or expired code.' });
    }
    const { cookie } = buildAdminActorCookie(userId);
    res.setHeader('Set-Cookie', cookie);
    await recordAuditEvent({ action: 'admin_session_bind', outcome: 'success', actorUserId: userId, detail: 'bound' });
    return res.json({ ok: true, actorUserId: userId });
  });

  app.post('/admin/api/session/logout', requireOpsStrict, (_req, res) => {
    res.setHeader('Set-Cookie', clearAdminActorCookie());
    return res.json({ ok: true });
  });

  app.post('/admin/api/secrets/reveal-token', jsonParser, adminRevealLimiter, requireSuperAdmin, async (req, res) => {
    const secretKey = String(req.body?.secretKey || '').trim();
    const actor = (req as Request & { adminActor?: string }).adminActor || '';
    if (!secretKey || !isSecretSettingKey(secretKey)) {
      await recordAuditEvent({ action: 'secret_reveal_denied', outcome: 'failure', actorUserId: actor, detail: secretKey || 'invalid_key' });
      return res.status(400).json({ error: 'Invalid secret key.' });
    }
    const issued = await issueRevealToken(secretKey, actor);
    await recordAuditEvent({ action: 'secret_reveal_token_issued', outcome: 'success', actorUserId: actor, detail: secretKey });
    return res.json({ token: issued.token, expiresInSec: issued.expiresInSec });
  });

  app.post('/admin/api/secrets/reveal', jsonParser, adminRevealLimiter, requireSuperAdmin, async (req, res) => {
    const actor = (req as Request & { adminActor?: string }).adminActor || '';
    const token = String(req.body?.token || '').trim();
    const row = await consumeRevealToken(token);
    if (!row || row.actorUserId !== actor) {
      await recordAuditEvent({ action: 'secret_reveal_denied', outcome: 'failure', actorUserId: actor, detail: 'expired_or_used' });
      return res.status(410).json({ error: 'Reveal token invalid or expired.' });
    }
    const secret = getRuntime(row.secretKey);
    await recordAuditEvent({ action: 'secret_reveal_consumed', outcome: 'success', actorUserId: actor, detail: row.secretKey });
    return res.json({ key: row.secretKey, secret, expiresInSec: getSecretRevealTtlSeconds() });
  });

  app.get('/admin/api/audit-log', adminApiLimiter, requireOpsStrict, async (req, res) => {
    const filters = parseAuditLogFilters(req.query as Record<string, unknown>);
    const page = await listRecentAuditEventsPage(Number(req.query.limit) || 50, filters, decodeAuditCursor(req.query.cursor));
    const events = page.events.filter(event => !REVEAL_ACTIONS.has(event.action));
    return res.json({ events, nextCursor: page.nextCursor, count: events.length });
  });

  app.get('/admin/api/audit-log/reveals', adminApiLimiter, requireSuperAdmin, async (req, res) => {
    const page = await listRecentAuditEventsPage(Number(req.query.limit) || 50, parseAuditLogFilters({
      ...req.query as Record<string, unknown>,
      action: typeof req.query.action === 'string' ? req.query.action : 'secret_reveal_consumed',
    }), decodeAuditCursor(req.query.cursor));
    const events = page.events
      .filter(event => REVEAL_ACTIONS.has(event.action))
      .map(event => ({ ...event, detail: event.detail }));
    return res.json({ events, count: events.length, nextCursor: page.nextCursor });
  });

  app.get('/admin/api/toggles', requireAdminPanelAccess, async (_req, res) => {
    await ensureFeatureTogglesLoaded();
    return res.json({ toggles: describeAllFeatureToggles() });
  });

  app.put('/admin/api/toggles', jsonParser, requireOpsStrict, async (req, res) => {
    const updated = await replaceFeatureToggles(req.body || {});
    return res.json({ ok: true, ...updated });
  });

  app.get('/admin/api/pricing', requireAdminPanelAccess, async (_req, res) => {
    return res.json({ model: await getPricingModel() });
  });

  app.put('/admin/api/pricing', jsonParser, requireOpsStrict, async (req, res) => {
    const model = await updatePricingModel(req.body || {});
    return res.json({ ok: true, model });
  });

  app.get('/admin/api/channels/:id/services', requireAdminPanelAccess, async (req, res) => {
    const override = await getChannelServiceOverride(pathParam(req.params.id));
    return res.json({ channelId: pathParam(req.params.id), services: override ?? null });
  });

  app.put('/admin/api/channels/:id/services', jsonParser, requireOpsStrict, async (req, res) => {
    const services = Array.isArray(req.body?.services) ? req.body.services.map(String) : null;
    const result = await setChannelServiceOverride(pathParam(req.params.id), services);
    if (!result.ok) return res.status(503).json({ error: result.error });
    return res.json({ ok: true });
  });

  app.get('/admin/api/users', adminApiLimiter, requireOpsStrict, async (req, res) => {
    if (req.query.sales === '1' || req.query.sales === 'true') {
      const ids = await listVerifiedSalesLineUserIds();
      const users = await Promise.all(ids.map(async id => redactProfile(id, await getUserProfile(id))));
      return res.json({ users });
    }
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
    const partnerId = Number(req.query.partnerId);
    let resolved = userId;
    if (!resolved && phone) resolved = await findLineUserIdByPhone(phone) || '';
    if (!resolved && Number.isInteger(partnerId) && partnerId > 0) {
      resolved = await findVerifiedUserIdByPartnerId(partnerId) || '';
    }
    if (!resolved) return res.status(400).json({ error: 'userId, phone, partnerId, or sales=1 required.' });
    return res.json({ users: [redactProfile(resolved, await getUserProfile(resolved))] });
  });

  app.patch('/admin/api/users/:id', jsonParser, requireOpsStrict, async (req, res) => {
    const userId = pathParam(req.params.id);
    if (req.body?.language === 'en' || req.body?.language === 'th') {
      await setUserLanguage(userId, req.body.language);
    }
    if (typeof req.body?.marketingOptIn === 'boolean') {
      await setMarketingOptIn(userId, req.body.marketingOptIn);
    }
    if (req.body?.clearPendingFlow === true) {
      await setUserPendingFlow(userId, null);
    }
    return res.json({ ok: true, user: redactProfile(userId, await getUserProfile(userId)) });
  });

  app.get('/admin/api/privileges', requireOpsStrict, (_req, res) => {
    return res.json({
      adminUserIds: [...getEffectiveAdminUserIds()],
      lock: isAdminConfigLocked(),
    });
  });

  app.post('/admin/api/privileges/enable', jsonParser, requireSuperAdmin, async (req, res) => {
    const userId = String(req.body?.userId || '').trim();
    const profile = await getUserProfile(userId);
    const authorization = isAuthorizedForAdminRole(userId, profile);
    if (!authorization.ok) return res.status(403).json({ error: authorization.reason });
    const odoo = await verifyOdooAdminAccess();
    if (!odoo.ok) return res.status(403).json({ error: odoo.message });
    const roleResult = await setUserRole(userId, 'admin');
    await recordAuditEvent({ action: 'role_grant', outcome: roleResult.ok ? 'success' : 'failure', actorUserId: (req as Request & { adminActor?: string }).adminActor || 'ops', targetId: userId });
    if (!roleResult.ok) return res.status(503).json({ error: 'Role update failed.' });
    return res.json({ ok: true });
  });

  app.get('/admin/api/approvals', requireOpsStrict, async (req, res) => {
    const records = await listRecentApprovals(Number(req.query.limit) || 50);
    return res.json({ records, count: records.length });
  });

  app.post('/admin/api/odoo-hook', jsonParser, requireOpsStrict, async (req, res) => {
    const result = await handleOdooHook(req.body);
    return res.status(result.status).json(result);
  });

  app.post('/admin/api/jobs/:name', jsonParser, adminApiLimiter, async (req, res) => {
    const token = req.get('authorization')?.startsWith('Bearer ') ? req.get('authorization')!.substring(7) : '';
    if (!isValidAdminToken(token)) return res.status(401).json({ error: 'ADMIN_SECRET_TOKEN required.' });
    const name = pathParam(req.params.name);
    if (!['daily-report', 'segmentation', 'seed-odoo'].includes(name)) {
      return res.status(404).json({ error: 'Unknown job.' });
    }
    try {
      if (name === 'daily-report') {
        await runDailyReport();
        return res.json({ ok: true, message: 'Daily report triggered successfully' });
      }
      if (name === 'segmentation') {
        const { runSegmentationJob } = await import('../jobs/segmentation');
        await runSegmentationJob();
        return res.json({ ok: true, message: 'Segmentation job triggered successfully' });
      }
      const status = await seedOdooSampleSalesDataWithAudit('admin');
      return res.json({ ok: true, message: status });
    } catch (error) {
      return res.status(500).json({ error: String(error) });
    }
  });

  app.get('/admin/api/erp/test', requireOpsStrict, async (_req, res) => {
    const cfg = getOdooConfig();
    return res.json({ ok: Boolean(cfg && isOdooConfigured()), configured: Boolean(cfg) });
  });

  app.get('/admin/api/platform', requireAdminPanelAccess, async (_req, res) => {
    return res.json(await getPlatformStatus());
  });
};
