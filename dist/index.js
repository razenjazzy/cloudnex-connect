"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const middleware_1 = require("./http/middleware");
const runtime_state_1 = require("./http/runtime-state");
const demo_session_1 = require("./http/demo-session");
const feature_toggles_1 = require("./services/feature-toggles");
const runtime_settings_1 = require("./services/runtime-settings");
const rate_limit_store_1 = require("./services/rate-limit-store");
const health_routes_1 = require("./http/health-routes");
const ops_routes_1 = require("./http/ops-routes");
const verify_routes_1 = require("./http/verify-routes");
const webhook_routes_1 = require("./http/webhook-routes");
const jobs_routes_1 = require("./http/jobs-routes");
const demo_routes_1 = require("./http/demo-routes");
const admin_panel_routes_1 = require("./http/admin-panel-routes");
const openapi_routes_1 = require("./http/openapi-routes");
const graphql_routes_1 = require("./http/graphql-routes");
const tracing_1 = require("./observability/tracing");
const workers_1 = require("./jobs/workers");
const env_1 = require("./http/env");
const logger_1 = require("./services/logger");
const base_repository_1 = require("./infra/mongo/base-repository");
const queue_1 = require("./jobs/queue");
const registry_1 = require("./erp/registry");
const app = (0, express_1.default)();
app.set('trust proxy', 1);
const port = process.env.PORT || 8080;
app.use(middleware_1.cspMiddleware);
app.use(middleware_1.requestLoggingMiddleware);
(0, health_routes_1.registerHealthRoutes)(app);
(0, ops_routes_1.registerOpsRoutes)(app);
(0, verify_routes_1.registerVerifyRoutes)(app);
(0, webhook_routes_1.registerWebhookRoutes)(app);
(0, jobs_routes_1.registerJobsRoutes)(app);
(0, demo_routes_1.registerDemoRoutes)(app);
(0, admin_panel_routes_1.registerAdminPanelRoutes)(app);
(0, openapi_routes_1.registerOpenApiRoutes)(app);
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000);
const startServer = async () => {
    (0, registry_1.getErpAdapter)();
    const { warmProductCatalog } = await Promise.resolve().then(() => __importStar(require('./erp/odoo-adapter')));
    warmProductCatalog();
    (0, tracing_1.initTracing)();
    await (0, graphql_routes_1.registerGraphqlRoutes)(app);
    (0, runtime_state_1.setRateStore)(await (0, rate_limit_store_1.createRateLimitStoreFromEnv)(runtime_state_1.fallbackRateStore));
    await (0, demo_session_1.ensureDemoSessionStateLoaded)();
    await (0, feature_toggles_1.ensureFeatureTogglesLoaded)();
    await (0, runtime_settings_1.hydrateRuntimeSettings)();
    const workers = env_1.isBullmqWorkerEnabled ? (0, workers_1.startQueueWorkers)() : [];
    const server = app.listen(port, () => {
        logger_1.appLogger.info('server_listening', { port, appEnv: env_1.appEnv, nodeEnv: process.env.NODE_ENV || 'development' });
    });
    const shutdown = (signal) => {
        logger_1.appLogger.info('server_shutdown', { signal });
        const forceExitTimer = setTimeout(() => {
            logger_1.appLogger.warn('shutdown_timeout');
            process.exit(1);
        }, SHUTDOWN_TIMEOUT_MS);
        forceExitTimer.unref();
        server.close((err) => {
            void (async () => {
                if (err) {
                    logger_1.appLogger.error('server_close_error', { error: String(err) });
                    process.exit(1);
                }
                await Promise.all(workers.map((worker) => worker.close()));
                await (0, queue_1.closeQueues)().catch(() => undefined);
                await (0, base_repository_1.closeMongo)().catch(() => undefined);
                await (0, tracing_1.shutdownTracing)().catch(() => undefined);
                clearTimeout(forceExitTimer);
                logger_1.appLogger.info('server_closed');
                process.exit(0);
            })();
        });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};
startServer().catch(error => {
    logger_1.appLogger.error('server_start_failed', { error: String(error) });
    process.exit(1);
});
