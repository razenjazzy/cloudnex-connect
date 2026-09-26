import express from 'express';
import { buildAdminCspHeader, buildCspHeader, buildDemoCspHeader, buildSwaggerCspHeader } from '../utils/html';
import { isGuideCommand } from '../line/command-guide';
import { recordHttpRequest } from '../services/kpi';
import { appLogger } from '../services/logger';
import { getRateStore } from './runtime-state';
import { isProduction } from './env';
import { adminBase, demoBase } from './public-bases';

export const jsonParser = express.json({ limit: process.env.MAX_JSON_BODY || '64kb' });
export const formParser = express.urlencoded({ extended: false, limit: process.env.MAX_JSON_BODY || '256kb' });

const pathUnder = (path: string, root: string): boolean => path === root || path.startsWith(`${root}/`);

export const cspHeaderForPath = (path: string): string => {
    if (path === '/api-docs' || path.startsWith('/api-docs/')) return buildSwaggerCspHeader();
    if (pathUnder(path, demoBase())) return buildDemoCspHeader();
    if (pathUnder(path, adminBase())) return buildAdminCspHeader();
    return buildCspHeader();
};

export const cspMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('Content-Security-Policy', cspHeaderForPath(req.path));
    next();
};

export const requestLoggingMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const headerRequestId = req.get('x-request-id') || '';
    const requestId = headerRequestId || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    res.setHeader('x-request-id', requestId);

    const startedAt = Date.now();
    res.on('finish', () => {
        const durationMs = Date.now() - startedAt;
        recordHttpRequest(req.path, req.method, res.statusCode);
        const summary = {
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs,
        };

        if (res.statusCode >= 500) {
            appLogger.error('http_access', summary);
        } else if (res.statusCode >= 400) {
            appLogger.warn('http_access', summary);
        } else {
            appLogger.info('http_access', summary);
        }
    });

    return next();
};

export const getBearerToken = (authHeader: string | undefined): string => {
    if (!authHeader?.startsWith('Bearer ')) return '';
    return authHeader.substring(7);
};

export const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    let timeoutHandle: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<T>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
    }
};

export const createRateLimiter = (options: { windowMs: number; max: number; label: string }) => {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const now = Date.now();
        try {
            const rateStore = getRateStore();
            await rateStore.sweep(now);
            const ip = req.ip || req.socket.remoteAddress || 'unknown';
            const key = `${options.label}:${ip}`;
            const window = await rateStore.consume(key, options.windowMs, now);
            if (window.count > options.max) {
                return res.status(429).json({ error: 'Too many requests' });
            }
        } catch (error) {
            appLogger.warn('rate_limiter_error', { error: String(error) });
        }
        return next();
    };
};

export const webhookLimiter = createRateLimiter({ windowMs: 60_000, max: 120, label: 'webhook' });
export const webhookTestLimiter = createRateLimiter({ windowMs: 60_000, max: 30, label: 'webhook-test' });
export const opsJobLimiter = createRateLimiter({ windowMs: 60_000, max: 10, label: 'ops-job' });
export const verifyLinkLimiter = createRateLimiter({ windowMs: 60_000, max: 20, label: 'verify-odoo' });
export const adminApiLimiter = createRateLimiter({ windowMs: 60_000, max: 120, label: 'admin-api' });
export const adminRevealLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 5, label: 'admin-reveal' });

export const isReadOnlyWebhookTestCommand = (text: string): boolean => {
    const upperText = text.trim().toUpperCase();
    if (!upperText) return true;
    if (isGuideCommand(text)) return true;

    return [
        'START',
        'HELP',
        'OPTIONS',
        'MENU',
        'FEATURES',
        'JOURNEY',
        'DEMO JOURNEY',
        'NAME',
        'LANG',
        'LANG EN',
        'LANG TH',
        'THAI',
        'ENGLISH',
        'BACK',
        'NAV HOME',
        'NAV COMMERCE',
        'SYSTEM STATUS',
    ].includes(upperText)
        || upperText.startsWith('PRODUCT FIND ')
        || upperText.startsWith('ORDER STATUS ')
        || upperText === 'PRODUCT FIND'
        || upperText === 'ORDER STATUS';
};

export const toSafeLogText = (text: string): string => {
    if (!isProduction) return text;
    const compact = text.replace(/\s+/g, ' ').trim();
    const clipped = compact.slice(0, 32);
    return `${clipped}${compact.length > 32 ? '...' : ''}`;
};
