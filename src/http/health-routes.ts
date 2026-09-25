import type { Express } from 'express';
import { appEnv } from './env';
import { getPlatformStatus } from '../platform/status';
import { isBootstrapComplete } from '../services/runtime-settings';

export const registerHealthRoutes = (app: Express): void => {
    app.get('/healthz', (_req, res) => {
        res.status(200).json({
            ok: true,
            service: 'cloudnex-connect',
            environment: appEnv,
            appEnv,
            nodeEnv: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString(),
        });
    });

    app.get('/readyz', async (_req, res) => {
        const status = await getPlatformStatus();
        return res.status(status.ready ? 200 : 503).json({
            ready: status.ready,
            bootstrapComplete: await isBootstrapComplete(),
            checks: status.checks,
            flags: status.flags,
            warnings: status.warnings,
            uptimeSeconds: status.uptimeSeconds,
            timestamp: status.timestamp,
        });
    });
};
