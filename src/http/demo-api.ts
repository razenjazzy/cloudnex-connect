import type { Express, NextFunction, Request, RequestHandler } from 'express';
import { getAgentName } from '../line/channels';
import { resolveCommandReply, type CommandReplyContext } from '../line/command-router';
import { getUserLanguage, getUserProfile } from '../services/firestore';
import { getDemoOverview, runDemoJourney } from '../services/demo';
import { getDemoPlatformPayload } from '../platform/service-modules';
import { getPlatformFlags } from '../platform/status';
import { getPricingModel, runPricingSimulation, updatePricingModel } from '../services/pricing-control';
import { describeAllFeatureToggles, ensureFeatureTogglesLoaded, replaceFeatureToggles } from '../services/feature-toggles';
import { runRuntimeProbes, collectProbeFailures } from '../services/runtime-probes';
import { jsonParser } from './middleware';
import { getRateStore } from './runtime-state';
import { ensureDemoSessionStateLoaded } from './demo-session';
import {
  demoControlToken,
  isDemoControlEnabled,
  isProduction,
  isWebhookTestEnabled,
  opsApiToken,
  readyzTimeoutMs,
  webhookTestToken,
} from './env';
import { originFromPublicBaseUrl } from './public-bases';

const requestOrigin = (req: Request): string =>
  originFromPublicBaseUrl(`${req.protocol}://${req.get('host')}`) || `${req.protocol}://${req.get('host')}`;

export const requireDemoPanelEnabled: RequestHandler = (_req, res, next: NextFunction) => {
  if (!isDemoControlEnabled) {
    return res.status(404).json({ error: 'Demo control panel is disabled.' });
  }
  return next();
};

export const registerDemoJsonRoutes = (app: Express, prefix: string, gate: RequestHandler): void => {
  const P = prefix.replace(/\/+$/, '');

  app.get(`${P}/connections`, requireDemoPanelEnabled, gate, async (req, res) => {
    try {
      const overview = await getDemoOverview(requestOrigin(req));
      res.json(overview);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get(`${P}/platform`, requireDemoPanelEnabled, gate, (_req, res) => {
    res.json({ ...getDemoPlatformPayload(), flags: getPlatformFlags() });
  });

  app.post(`${P}/journey`, requireDemoPanelEnabled, gate, jsonParser, async (req, res) => {
    try {
      const result = await runDemoJourney(req.body || {});
      res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post(`${P}/chat`, requireDemoPanelEnabled, gate, jsonParser, async (req, res) => {
    try {
      const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      if (!rawText) return res.status(400).json({ error: 'Missing chat text.' });
      const rawUserId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
      const userId = rawUserId && rawUserId.length <= 120 ? rawUserId : 'web_demo_user';
      const userLanguage = await getUserLanguage(userId);
      const profile = await getUserProfile(userId);
      const agentName = getAgentName(userLanguage);
      const ctx: CommandReplyContext = {
        text: rawText,
        userId,
        userLanguage,
        profile,
        agentName,
        baseUrl: requestOrigin(req),
        requestId: String(res.getHeader('x-request-id') || '') || undefined,
      };
      const botMessages = await resolveCommandReply(ctx);
      const { applyTrayAfterReply } = await import('../line/rich-menu');
      applyTrayAfterReply(userId, ctx.userLanguage, 'default', ctx.trayHighlight, ctx.trayRest);
      const transcript = botMessages.map(message => {
        if (message.type === 'text') return { kind: 'text', text: message.text };
        return { kind: 'card', text: (message.type === 'flex' ? message.altText : 'Card') || 'Card' };
      });
      return res.json({ agentName, transcript });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get(`${P}/pricing-model`, requireDemoPanelEnabled, gate, (_req, res) => {
    return getPricingModel()
      .then(model => res.json({ generatedAt: new Date().toISOString(), model }))
      .catch(error => res.status(500).json({ error: String(error) }));
  });

  app.put(`${P}/pricing-model`, requireDemoPanelEnabled, gate, jsonParser, async (req, res) => {
    try {
      const updated = await updatePricingModel(req.body || {});
      res.json({ ok: true, generatedAt: new Date().toISOString(), model: updated });
    } catch (error) {
      res.status(400).json({ ok: false, error: String(error) });
    }
  });

  app.post(`${P}/pricing-simulation`, requireDemoPanelEnabled, gate, jsonParser, async (req, res) => {
    try {
      await getPricingModel();
      res.json(runPricingSimulation(req.body || {}));
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  app.get(`${P}/sales-feature-toggles`, requireDemoPanelEnabled, gate, (_req, res) => {
    return ensureFeatureTogglesLoaded()
      .then(() => res.json({ generatedAt: new Date().toISOString(), toggles: describeAllFeatureToggles() }))
      .catch(error => res.status(500).json({ error: String(error) }));
  });

  app.put(`${P}/sales-feature-toggles`, requireDemoPanelEnabled, gate, jsonParser, async (req, res) => {
    try {
      const updated = await replaceFeatureToggles(req.body || {});
      res.json({ ok: true, generatedAt: new Date().toISOString(), ...updated });
    } catch (error) {
      res.status(400).json({ ok: false, error: String(error) });
    }
  });

  app.get(`${P}/workflow-audit`, requireDemoPanelEnabled, gate, async (_req, res) => {
    await ensureDemoSessionStateLoaded();
    const failures: string[] = [];
    if (!opsApiToken) failures.push('OPS_API_TOKEN is not configured');
    if (isDemoControlEnabled && !demoControlToken) failures.push('DEMO_CONTROL_TOKEN is not configured while the demo panel is enabled');
    if (isWebhookTestEnabled && isProduction && !webhookTestToken) {
      failures.push('WEBHOOK_TEST_TOKEN should be configured when ENABLE_WEBHOOK_TEST is enabled on a NODE_ENV=production host');
    }
    const runtimeChecks = await runRuntimeProbes(getRateStore(), readyzTimeoutMs);
    failures.push(...collectProbeFailures(runtimeChecks));
    res.json({
      generatedAt: new Date().toISOString(),
      score: Math.max(0, 100 - failures.length * 20),
      status: failures.length ? 'needs_attention' : 'ready_for_uat',
      runtime: runtimeChecks,
      failures,
    });
  });
};
