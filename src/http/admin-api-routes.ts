import type { Express, NextFunction, Request, Response } from 'express';
import { getErpAdapter, isErpImplemented } from '../erp/registry';
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
import { jsonParser, formParser, adminApiLimiter, adminRevealLimiter } from './middleware';
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
import {
  buildLineAuthorizeUrl,
  buildOktaAuthorizeUrl,
  buildSamlMetadataXml,
  buildSamlRedirectUrl,
  clearOauthStateCookie,
  consumeOauthState,
  describeAdminIdp,
  exchangeLineLoginCode,
  exchangeOktaCode,
  issueOauthState,
  verifySamlResponse,
} from '../services/admin-idp';
import { isAuthorizedForAdminRole } from '../services/admin-authorization';
import { commandActor, getCommandGridPayload } from '../line/command-grid';
import { verifyOdooAdminAccess } from '../services/odoo/admin';
import { sendTargetedMessage, sendBroadcastMessage } from '../line/messaging';
import { SALES_CHANNEL_ID, getChannelServiceOverride, setChannelServiceOverride, resolveChannelConfig } from '../line/channels';
import { parseCampaignAudienceRequest, parseCampaignBroadcastRequest, parseCampaignSendRequest, parseCampaignTestText, resolveCampaignAudience } from '../line/campaigns';
import { createQueuedCampaign, findCampaignByIdempotencyKey, listCampaigns } from '../jobs/campaign-store';
import { enqueueCampaignSend, isQueueBackendReady } from '../jobs/queue';
import { describeOptionalFlags } from './optional-flags';
import { describeAllFeatureToggles, ensureFeatureTogglesLoaded, replaceFeatureToggles } from '../services/feature-toggles';
import { getPricingModel, updatePricingModel } from '../services/pricing-control';
import { getDemoPlatformPayload } from '../platform/service-modules';
import { loadCommandOverlay, sanitizeCommandOverlay, saveCommandOverlay } from '../line/command-overlay';
import { getActiveTenantKey } from '../services/tenant';
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

const normalizeLineUserId = (raw: string): string => raw.trim();

const toAdminUserView = async (userId: string) => {
  const id = normalizeLineUserId(userId);
  const profile = await getUserProfile(id);
  const adminAuth = isAuthorizedForAdminRole(id, profile);
  let odooPrivileges = { configured: isOdooConfigured(), groups: [] as string[] };
  try {
    const describe = getErpAdapter().describePartnerPrivileges;
    if (describe && profile.odooPartnerId) {
      odooPrivileges = await describe(profile.odooPartnerId);
    }
  } catch {
    // ERP unset or unimplemented: LINE/Firestore dossier still returns.
  }
  return {
    ...redactProfile(id, profile),
    commandRole: commandActor(profile),
    lineAdminAllowlisted: adminAuth.ok,
    lineAdminReason: adminAuth.reason,
    superAdmin: isSuperAdminActor(id, profile),
    odooPrivileges,
  };
};

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
      idp: describeAdminIdp(),
      appEnv,
      optionalFlags: describeOptionalFlags(),
      queueReady: isQueueBackendReady(),
    });
  });

  app.get('/admin/api/commands', adminApiLimiter, requireAdminPanelAccess, async (_req, res) => {
    await loadCommandOverlay();
    return res.json({ commands: getCommandGridPayload(), tenantKey: getActiveTenantKey() });
  });

  app.put('/admin/api/commands', jsonParser, adminApiLimiter, requireOpsStrict, async (req, res) => {
    const parsed = sanitizeCommandOverlay(req.body?.commands);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const saved = await saveCommandOverlay(parsed.commands);
    if (!saved.ok) return res.status(503).json({ error: saved.error || 'Could not save command overlay.' });
    await loadCommandOverlay();
    return res.json({ ok: true, commands: getCommandGridPayload(), tenantKey: getActiveTenantKey() });
  });

  app.get('/admin/api/tenant', requireAdminPanelAccess, (_req, res) => {
    return res.json({ tenantKey: getActiveTenantKey() });
  });

  app.put('/admin/api/tenant', jsonParser, requireOpsStrict, async (req, res) => {
    const tenantKey = String(req.body?.tenantKey || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!tenantKey) return res.status(400).json({ error: 'tenantKey is required.' });
    const result = await mergeRuntimeOverlay({ TENANT_KEY: tenantKey });
    if (!result.ok) return res.status(403).json({ error: result.error });
    return res.json({ ok: true, tenantKey: getActiveTenantKey() });
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

  app.post('/admin/api/line-channels', jsonParser, adminApiLimiter, requireSuperAdmin, async (req, res) => {
    const channelId = String(req.body?.channelId || '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{0,31}$/.test(channelId)) {
      return res.status(400).json({ error: 'channelId must be a lowercase slug (e.g. hr).' });
    }
    const envKey = channelId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const secret = String(req.body?.secret || '').trim();
    const accessToken = String(req.body?.accessToken || '').trim();
    if (!secret || !accessToken) {
      return res.status(400).json({ error: 'secret and accessToken are required.' });
    }
    const patch: Record<string, string> = {
      [`LINE_CHANNEL_${envKey}_SECRET`]: secret,
      [`LINE_CHANNEL_${envKey}_ACCESS_TOKEN`]: accessToken,
    };
    if (typeof req.body?.services === 'string' && req.body.services.trim()) {
      patch[`LINE_CHANNEL_${envKey}_SERVICES`] = req.body.services.trim();
    }
    if (typeof req.body?.basicId === 'string' && req.body.basicId.trim()) {
      patch[`LINE_CHANNEL_${envKey}_BASIC_ID`] = req.body.basicId.trim();
    }
    if (typeof req.body?.richMenuJson === 'string' && req.body.richMenuJson.trim()) {
      patch[`LINE_CHANNEL_${envKey}_RICH_MENU_JSON`] = req.body.richMenuJson.trim();
    }
    const result = await mergeRuntimeOverlay(patch);
    const actor = (req as Request & { adminActor?: string }).adminActor || 'unknown';
    await recordAuditEvent({
      action: 'channel_config_update',
      outcome: result.ok ? 'success' : 'failure',
      actorUserId: actor,
      detail: channelId,
    });
    if (!result.ok) return res.status(403).json({ error: result.error });
    const origin = (getRuntime('PUBLIC_BASE_URL') || '').replace(/\/$/, '') || 'https://example.invalid';
    return res.json({
      ok: true,
      channelId,
      webhookUrl: `${origin}/webhook/${channelId}`,
    });
  });

  app.post('/admin/api/campaigns/preview', jsonParser, adminApiLimiter, requireSuperAdmin, async (req, res) => {
    const parsed = parseCampaignAudienceRequest(req.body);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    const result = await resolveCampaignAudience(parsed);
    if (!result.ok) return res.status(400).json({ error: result.error });
    return res.json({
      ok: true,
      audienceType: parsed.audienceType,
      channelId: parsed.channelId,
      language: parsed.language || null,
      count: result.userIds.length,
      skipped: result.skipped,
    });
  });

  app.post('/admin/api/campaigns/test', jsonParser, adminApiLimiter, requireSuperAdmin, async (req, res) => {
    const parsed = parseCampaignAudienceRequest(req.body);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    const text = parseCampaignTestText(req.body);
    if (typeof text !== 'string') return res.status(400).json({ error: text.error });
    if (!resolveChannelConfig(parsed.channelId)) {
      return res.status(400).json({ error: 'LINE channel is not configured.' });
    }
    const actor = (req as Request & { adminActor?: string }).adminActor || '';
    const audience = await resolveCampaignAudience(parsed);
    const previewCount = audience.ok ? audience.userIds.length : 0;
    const delivered = await sendTargetedMessage(
      [actor],
      `[Cloudnex test] ${text}`,
      parsed.channelId,
    );
    await recordAuditEvent({
      action: 'campaign_test',
      outcome: delivered === false ? 'failure' : 'success',
      actorUserId: actor,
      channelId: parsed.channelId,
      detail: parsed.audienceType,
    });
    if (delivered === false) return res.status(503).json({ error: 'Test push failed.' });
    return res.json({
      ok: true,
      to: actor,
      channelId: parsed.channelId,
      audienceCount: previewCount,
    });
  });

  app.post('/admin/api/campaigns/send', jsonParser, adminApiLimiter, requireSuperAdmin, async (req, res) => {
    const parsed = parseCampaignSendRequest(req.body);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    if (!resolveChannelConfig(parsed.channelId)) {
      return res.status(400).json({ error: 'LINE channel is not configured.' });
    }
    if (!isQueueBackendReady()) {
      return res.status(503).json({ error: 'REDIS_URL is required to queue campaign send.' });
    }
    const audience = await resolveCampaignAudience(parsed);
    if (!audience.ok) return res.status(400).json({ error: audience.error });
    if (audience.userIds.length === 0) return res.status(400).json({ error: 'Audience is empty.' });
    const actor = (req as Request & { adminActor?: string }).adminActor || '';
    const idempotencyKey = String(req.get('idempotency-key') || '').trim();
    if (idempotencyKey) {
      const existing = await findCampaignByIdempotencyKey(idempotencyKey);
      if (existing) return res.status(200).json({ ok: true, campaign: existing, replayed: true });
    }
    const campaign = await createQueuedCampaign({
      audienceType: parsed.audienceType,
      channelId: parsed.channelId,
      text: parsed.text,
      count: audience.userIds.length,
      actorUserId: actor,
      idempotencyKey: idempotencyKey || undefined,
      delivery: 'multicast',
      language: parsed.language,
      userIds: audience.userIds,
    });
    const jobId = await enqueueCampaignSend(campaign.id, actor);
    await recordAuditEvent({
      action: 'campaign_send',
      outcome: 'success',
      actorUserId: actor,
      channelId: parsed.channelId,
      detail: campaign.id,
    });
    return res.status(202).json({ ok: true, queued: true, jobId, campaign });
  });

  app.post('/admin/api/campaigns/broadcast', jsonParser, adminApiLimiter, requireSuperAdmin, async (req, res) => {
    const parsed = parseCampaignBroadcastRequest(req.body);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    if (!resolveChannelConfig(parsed.channelId)) {
      return res.status(400).json({ error: 'LINE channel is not configured.' });
    }
    const actor = (req as Request & { adminActor?: string }).adminActor || '';
    const delivered = await sendBroadcastMessage(parsed.text, parsed.channelId);
    await recordAuditEvent({
      action: 'campaign_broadcast',
      outcome: delivered ? 'success' : 'failure',
      actorUserId: actor,
      channelId: parsed.channelId,
    });
    if (!delivered) return res.status(503).json({ error: 'Broadcast failed.' });
    return res.json({ ok: true, delivery: 'broadcast', channelId: parsed.channelId });
  });

  app.get('/admin/api/campaigns', adminApiLimiter, requireSuperAdmin, async (_req, res) => {
    const campaigns = await listCampaigns(50);
    return res.json({ campaigns, count: campaigns.length });
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
    res.setHeader('Set-Cookie', [clearAdminActorCookie(), clearOauthStateCookie()]);
    return res.json({ ok: true });
  });

  app.get('/admin/api/session/me', adminApiLimiter, requireAdminPanelAccess, (req, res) => {
    const actor = parseAdminActorCookie(req.get('cookie'));
    return res.json({
      ok: true,
      appEnv,
      actorUserId: actor || null,
      actorFormat: 'LINE user id (U followed by 32 hex characters)',
      lock: isAdminConfigLocked(),
      optionalFlags: describeOptionalFlags(),
    });
  });

  const queryStr = (value: unknown): string => typeof value === 'string' ? value : '';

  const denyIdp = async (res: Response, userId: string, detail: string, asRedirect: boolean) => {
    await recordAuditEvent({ action: 'admin_session_bind', outcome: 'failure', actorUserId: userId || 'unknown', detail });
    if (asRedirect) return res.redirect(302, '/admin?idp_error=1');
    return res.status(403).json({ error: 'Not authorized to bind.' });
  };

  const completeIdp = async (res: Response, userId: string | null, detail: string, asRedirect: boolean) => {
    if (!userId) return denyIdp(res, '', `${detail}_missing_user`, asRedirect);
    const profile = await getUserProfile(userId);
    if (!isSuperAdminActor(userId, profile)) return denyIdp(res, userId, `${detail}_not_allowlisted`, asRedirect);
    const { cookie } = buildAdminActorCookie(userId);
    res.setHeader('Set-Cookie', [cookie, clearOauthStateCookie()]);
    await recordAuditEvent({ action: 'admin_session_bind', outcome: 'success', actorUserId: userId, detail });
    if (asRedirect) return res.redirect(302, '/admin');
    return res.json({ ok: true, actorUserId: userId });
  };

  app.get('/admin/api/session/idp', adminApiLimiter, async (req, res) => {
    if (!ipAllowedForAdmin(req.ip || req.socket.remoteAddress || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json(describeAdminIdp());
  });

  const startLine = async (req: Request, res: Response, redirect: boolean) => {
    if (!ipAllowedForAdmin(req.ip || req.socket.remoteAddress || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const issued = await issueOauthState('line_login');
    const url = buildLineAuthorizeUrl(issued.state, issued.verifier);
    if (!url) return res.status(503).json({ error: 'LINE Login is not configured.' });
    res.setHeader('Set-Cookie', issued.cookie);
    if (redirect) return res.redirect(302, url);
    return res.json({ url });
  };
  app.get('/admin/api/session/line/start', adminApiLimiter, (req, res) => void startLine(req, res, true));
  app.post('/admin/api/session/line/start', adminApiLimiter, (req, res) => void startLine(req, res, false));

  app.get('/admin/api/session/line/callback', adminApiLimiter, async (req, res) => {
    if (!ipAllowedForAdmin(req.ip || req.socket.remoteAddress || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const state = queryStr(req.query.state);
    const code = queryStr(req.query.code);
    const verifier = await consumeOauthState(state, req.get('cookie'), 'line_login');
    if (!verifier || !code) {
      await recordAuditEvent({ action: 'admin_session_bind', outcome: 'failure', actorUserId: 'unknown', detail: 'line_login_state' });
      return res.redirect(302, '/admin?idp_error=1');
    }
    const userId = await exchangeLineLoginCode(code, verifier);
    return completeIdp(res, userId, 'line_login', true);
  });

  const startOidc = async (req: Request, res: Response, redirect: boolean) => {
    if (!ipAllowedForAdmin(req.ip || req.socket.remoteAddress || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const issued = await issueOauthState('okta_oidc');
    const url = buildOktaAuthorizeUrl(issued.state, issued.verifier);
    if (!url) return res.status(503).json({ error: 'Okta OIDC is not configured.' });
    res.setHeader('Set-Cookie', issued.cookie);
    if (redirect) return res.redirect(302, url);
    return res.json({ url });
  };
  app.get('/admin/api/session/oidc/start', adminApiLimiter, (req, res) => void startOidc(req, res, true));
  app.post('/admin/api/session/oidc/start', adminApiLimiter, (req, res) => void startOidc(req, res, false));

  app.get('/admin/api/session/oidc/callback', adminApiLimiter, async (req, res) => {
    if (!ipAllowedForAdmin(req.ip || req.socket.remoteAddress || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const state = queryStr(req.query.state);
    const code = queryStr(req.query.code);
    const verifier = await consumeOauthState(state, req.get('cookie'), 'okta_oidc');
    if (!verifier || !code) {
      await recordAuditEvent({ action: 'admin_session_bind', outcome: 'failure', actorUserId: 'unknown', detail: 'okta_oidc_state' });
      return res.redirect(302, '/admin?idp_error=1');
    }
    const userId = await exchangeOktaCode(code, verifier);
    return completeIdp(res, userId, 'okta_oidc', true);
  });

  app.get('/admin/api/session/saml/metadata', adminApiLimiter, (req, res) => {
    if (!ipAllowedForAdmin(req.ip || req.socket.remoteAddress || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!describeAdminIdp().saml) return res.status(503).json({ error: 'SAML is not configured.' });
    res.type('application/xml').send(buildSamlMetadataXml());
  });

  app.get('/admin/api/session/saml/start', adminApiLimiter, async (req, res) => {
    if (!ipAllowedForAdmin(req.ip || req.socket.remoteAddress || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const issued = await issueOauthState('saml');
    const url = buildSamlRedirectUrl(issued.state);
    if (!url) return res.status(503).json({ error: 'SAML is not configured.' });
    res.setHeader('Set-Cookie', issued.cookie);
    return res.redirect(302, url);
  });

  app.post('/admin/api/session/saml/acs', formParser, adminApiLimiter, async (req, res) => {
    if (!ipAllowedForAdmin(req.ip || req.socket.remoteAddress || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const relay = String(req.body?.RelayState || '');
    const raw = String(req.body?.SAMLResponse || '');
    const verifier = await consumeOauthState(relay, req.get('cookie'), 'saml');
    if (!verifier || !raw) {
      await recordAuditEvent({ action: 'admin_session_bind', outcome: 'failure', actorUserId: 'unknown', detail: 'saml_state' });
      return res.redirect(302, '/admin?idp_error=1');
    }
    const audience = getRuntime('SAML_SP_ENTITY_ID') || `${getRuntime('PUBLIC_BASE_URL').replace(/\/$/, '')}/admin/api/session/saml/metadata`;
    const userId = verifySamlResponse(raw, audience, getRuntime('SAML_IDP_CERT'));
    return completeIdp(res, userId, 'saml', true);
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
      const users = await Promise.all(ids.map(id => toAdminUserView(id)));
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
    return res.json({ users: [await toAdminUserView(resolved)] });
  });

  app.get('/admin/api/users/:id', adminApiLimiter, requireOpsStrict, async (req, res) => {
    const userId = normalizeLineUserId(pathParam(req.params.id));
    if (!userId) return res.status(400).json({ error: 'LINE user id is required.' });
    return res.json({ user: await toAdminUserView(userId) });
  });

  app.get('/admin/api/users/:id/activity', adminApiLimiter, requireOpsStrict, async (req, res) => {
    const userId = normalizeLineUserId(pathParam(req.params.id));
    if (!userId) return res.status(400).json({ error: 'LINE user id is required.' });
    const page = await listRecentAuditEventsPage(
      Number(req.query.limit) || 50,
      parseAuditLogFilters({ userId }),
      decodeAuditCursor(req.query.cursor),
    );
    const events = page.events.filter(event => !REVEAL_ACTIONS.has(event.action));
    return res.json({ userId, events, nextCursor: page.nextCursor, count: events.length });
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
    return res.json({ ok: true, user: await toAdminUserView(userId) });
  });

  app.get('/admin/api/privileges', requireOpsStrict, (_req, res) => {
    return res.json({
      adminUserIds: [...getEffectiveAdminUserIds()],
      lock: isAdminConfigLocked(),
      odooConfigured: isOdooConfigured(),
      identityFormat: 'LINE user id (U + 32 hex). Lookup in Directory; Audit filters actor or target.',
      chain: [
        'LINE identity',
        'Firestore profile',
        'odooVerified',
        'ADMIN_USER_ID allowlist',
        'Odoo admin capability (ERP API)',
        'role=admin',
      ],
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
    const adapter = getErpAdapter();
    return res.json({
      ok: adapter.name === 'odoo' && Boolean(cfg && isOdooConfigured()),
      configured: Boolean(cfg),
      erpProvider: adapter.name,
      erpImplemented: isErpImplemented(),
    });
  });

  app.get('/admin/api/erp/status', requireOpsStrict, async (_req, res) => {
    const adapter = getErpAdapter();
    const signature = await adapter.describeSignatureStatus?.() || { ok: false, message: 'Not available.' };
    const payment = await adapter.describePaymentStatus?.() || { ok: false, message: 'Not available.' };
    return res.json({ erpProvider: adapter.name, erpImplemented: isErpImplemented(), signature, payment });
  });

  app.get('/admin/api/platform', requireAdminPanelAccess, async (_req, res) => {
    return res.json(await getPlatformStatus());
  });
};
