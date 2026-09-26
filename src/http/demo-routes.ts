import type { Express } from 'express';
import { jsonParser } from './middleware';
import { createDemoSessionToken, safeTokenMatch } from '../services/demo-session';
import {
  clearDemoSessionCookie,
  ensureDemoSessionStateLoaded,
  getActiveDemoSessionSecret,
  getPreviousDemoSessionSecretGraceActive,
  requireDemoControlAccess,
  setDemoSessionCookie,
  verifyIncomingDemoSession,
} from './demo-session';
import {
  allowDemoHeaderTokenFallbackInProd,
  demoControlToken,
  demoSessionTtlMinutes,
  isDemoControlEnabled,
  isProduction,
} from './env';
import { adminBase, demoBase } from './public-bases';
import { registerDemoJsonRoutes } from './demo-api';

export const registerDemoRoutes = (app: Express): void => {
  const D = demoBase();

  app.post(`${D}/session/login`, jsonParser, async (req, res) => {
    if (!isDemoControlEnabled) return res.status(404).json({ error: 'Demo control panel is disabled.' });
    await ensureDemoSessionStateLoaded();
    const activeSecret = getActiveDemoSessionSecret();
    if (!demoControlToken || !activeSecret) {
      return res.status(503).json({ error: 'Demo session login unavailable because required token or session secret is missing.' });
    }
    const providedToken = String(req.body?.token || '').trim();
    if (!safeTokenMatch(providedToken, demoControlToken)) {
      return res.status(401).json({ ok: false, error: 'Invalid demo access token.' });
    }
    const token = createDemoSessionToken(activeSecret, Math.max(60, Math.trunc(demoSessionTtlMinutes * 60)));
    setDemoSessionCookie(res, token);
    return res.json({ ok: true, ttlMinutes: demoSessionTtlMinutes });
  });

  app.post(`${D}/session/logout`, (_req, res) => {
    clearDemoSessionCookie(res);
    return res.json({ ok: true });
  });

  app.get(`${D}/session/status`, (req, res) => {
    if (!isDemoControlEnabled) return res.status(404).json({ error: 'Demo control panel is disabled.' });
    if (!isProduction) {
      return res.json({ authenticated: true, mode: 'development', sessionOnlyProduction: !allowDemoHeaderTokenFallbackInProd });
    }
    return verifyIncomingDemoSession(req)
      .then(({ sessionAuthenticated, tokenAuthenticated }) => res.json({
        authenticated: sessionAuthenticated || tokenAuthenticated,
        sessionAuthenticated,
        tokenAuthenticated,
        sessionOnlyProduction: !allowDemoHeaderTokenFallbackInProd,
        previousSessionSecretGraceActive: getPreviousDemoSessionSecretGraceActive(),
      }))
      .catch(error => res.status(500).json({ error: String(error) }));
  });

  app.get(D, (_req, res) => {
    if (!isDemoControlEnabled) return res.status(404).json({ error: 'Demo control panel is disabled.' });
    return res.redirect(302, `${adminBase()}/testing`);
  });

  registerDemoJsonRoutes(app, D, requireDemoControlAccess);
};
