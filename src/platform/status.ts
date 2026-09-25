import {
  appEnv,
  isApiDocsEnabled,
  isBullmqWorkerEnabled,
  isDeliveryProduction,
  isDemoControlEnabled,
  isGraphqlEnabled,
  isLineWebhookAsync,
  isMongoVectorEnabled,
  isOpsJobsAsync,
  isProduction,
  isStaging,
  isWebhookTestEnabled,
  mongoUri,
  opsApiToken,
  demoControlToken,
  readyzTimeoutMs,
} from '../http/env';
import { getRateStore } from '../http/runtime-state';
import { isQueueBackendReady } from '../jobs/queue';
import { runRuntimeProbes, type ProbeResult } from '../services/runtime-probes';
import { loadSkills } from '../services/skill-loader';
import { getServiceModules } from './service-modules';
import { auditEnvParams } from '../http/env-params';
import { lineAccessTokenExpiryWarnings } from '../services/line-access-token-expiry';
import { getEffectiveAdminUserIds, getRuntime } from '../services/runtime-settings';
import { isErpImplemented } from '../erp/registry';
import { isMongoUsersEnabled, mongoIdentityReady } from '../services/mongo-users';

export type PlatformCheck = ProbeResult & { required: boolean };

export type PlatformFlags = {
  appEnv: 'development' | 'staging' | 'production';
  environment: string;
  production: boolean;
  deliveryProduction: boolean;
  staging: boolean;
  erpProvider: string;
  erpImplemented: boolean;
  lineConfigured: boolean;
  lineCustomerConfigured: boolean;
  firestoreProjectConfigured: boolean;
  odooConfigured: boolean;
  mongoConfigured: boolean;
  mongoVectorEnabled: boolean;
  redisConfigured: boolean;
  graphqlEnabled: boolean;
  apiDocsEnabled: boolean;
  demoPanelEnabled: boolean;
  webhookTestEnabled: boolean;
  lineWebhookAsync: boolean;
  opsJobsAsync: boolean;
  bullmqWorkerEnabled: boolean;
  otelEnabled: boolean;
  groupBuyEnabled: boolean;
  clawEnabled: boolean;
  aiOff: boolean;
  opsTokenConfigured: boolean;
  adminAllowlistConfigured: boolean;
  demoControlTokenConfigured: boolean;
  skillsLoaded: number;
};

const envFlag = (value: string | undefined): boolean => /^(1|true|yes|on)$/i.test(value || '');

const isLineConfigured = (): boolean => Boolean(
  getRuntime('LINE_CHANNEL_SECRET') && getRuntime('LINE_CHANNEL_ACCESS_TOKEN'),
);

const isLineCustomerConfigured = (): boolean => Boolean(
  getRuntime('LINE_CHANNEL_CUSTOMER_SECRET') && getRuntime('LINE_CHANNEL_CUSTOMER_ACCESS_TOKEN'),
);

const isOdooConfigured = (): boolean => Boolean(
  getRuntime('ODOO_URL')
  && getRuntime('ODOO_DB')
  && getRuntime('ODOO_USERNAME')
  && getRuntime('ODOO_API_KEY'),
);

export const getPlatformFlags = (): PlatformFlags => ({
  appEnv,
  environment: process.env.NODE_ENV?.trim() || 'development',
  production: isProduction,
  deliveryProduction: isDeliveryProduction,
  staging: isStaging,
  erpProvider: process.env.ERP_PROVIDER?.trim().toLowerCase() || 'odoo',
  erpImplemented: (() => {
    try {
      return isErpImplemented();
    } catch {
      return false;
    }
  })(),
  lineConfigured: isLineConfigured(),
  lineCustomerConfigured: isLineCustomerConfigured(),
  firestoreProjectConfigured: Boolean(process.env.GOOGLE_CLOUD_PROJECT?.trim()),
  odooConfigured: isOdooConfigured(),
  mongoConfigured: Boolean(mongoUri),
  mongoVectorEnabled: isMongoVectorEnabled,
  redisConfigured: isQueueBackendReady(),
  graphqlEnabled: isGraphqlEnabled,
  apiDocsEnabled: isApiDocsEnabled,
  demoPanelEnabled: isDemoControlEnabled,
  webhookTestEnabled: isWebhookTestEnabled,
  lineWebhookAsync: isLineWebhookAsync,
  opsJobsAsync: isOpsJobsAsync,
  bullmqWorkerEnabled: isBullmqWorkerEnabled,
  otelEnabled: envFlag(process.env.OTEL_ENABLED),
  groupBuyEnabled: envFlag(process.env.GROUPBUY_ENABLED),
  clawEnabled: envFlag(process.env.CLAWFRAMEWORK_ENABLED),
  aiOff: envFlag(process.env.AI_OFF),
  opsTokenConfigured: Boolean(opsApiToken),
  adminAllowlistConfigured: getEffectiveAdminUserIds().size > 0,
  demoControlTokenConfigured: Boolean(demoControlToken),
  skillsLoaded: loadSkills().length,
});

const collectWarnings = (flags: PlatformFlags, checks: PlatformCheck[]): string[] => {
  const warnings: string[] = [];
  if (flags.lineWebhookAsync && !flags.redisConfigured) {
    warnings.push('LINE_WEBHOOK_ASYNC is on but REDIS_URL is missing; webhook stays synchronous.');
  }
  if (flags.opsJobsAsync && !flags.redisConfigured) {
    warnings.push('OPS_JOBS_ASYNC is on but REDIS_URL is missing; jobs run in-process.');
  }
  if (flags.deliveryProduction && flags.demoPanelEnabled) {
    warnings.push('Demo panel cannot be enabled in APP_ENV=production.');
  }
  if (isProduction && !process.env.APP_ENV?.trim()) {
    warnings.push('APP_ENV is unset with NODE_ENV=production; process is fail-closed as delivery production. Set APP_ENV=staging on Railway.');
  }
  if (flags.production && flags.webhookTestEnabled && !process.env.WEBHOOK_TEST_TOKEN?.trim() && !flags.opsTokenConfigured) {
    warnings.push('ENABLE_WEBHOOK_TEST is on in production without WEBHOOK_TEST_TOKEN.');
  }
  if (!flags.adminAllowlistConfigured) {
    warnings.push('ADMIN_USER_ID is unset; ADMIN ENABLE fails closed.');
  }
  if ((flags.staging || flags.deliveryProduction) && !flags.lineCustomerConfigured) {
    warnings.push('LINE_CHANNEL_CUSTOMER_SECRET or ACCESS_TOKEN unset; POST /webhook/customer will 404.');
  }
  if ((flags.staging || flags.deliveryProduction) && !process.env.LINE_CHANNEL_CUSTOMER_BASIC_ID?.trim()) {
    warnings.push('LINE_CHANNEL_CUSTOMER_BASIC_ID unset; Add-friend for unquoted customers will be missing.');
  }
  if (flags.mongoVectorEnabled && !flags.mongoConfigured) {
    warnings.push('MONGO_VECTOR_ENABLED is on but MONGODB_URI is unset.');
  }
  if (flags.production && flags.clawEnabled) {
    warnings.push('CLAWFRAMEWORK_ENABLED in production is unsupported; keep it off.');
  }
  warnings.push(...lineAccessTokenExpiryWarnings());
  const envAudit = auditEnvParams(flags.appEnv);
  for (const key of envAudit.missingRequired) {
    warnings.push(`Missing ${flags.appEnv} config: ${key}`);
  }
  for (const check of checks) {
    if (check.required && !check.ok) warnings.push(`${check.name}: ${check.message}`);
  }
  return warnings;
};

export const getPlatformStatus = async () => {
  const flags = getPlatformFlags();
  const probes = await runRuntimeProbes(getRateStore(), readyzTimeoutMs);
  const checks: PlatformCheck[] = [
    {
      name: 'line-customer',
      required: false,
      ok: flags.lineCustomerConfigured,
      message: flags.lineCustomerConfigured
        ? 'Cloudnex Customer secret and access token are set'
        : 'LINE_CHANNEL_CUSTOMER_SECRET or LINE_CHANNEL_CUSTOMER_ACCESS_TOKEN missing',
    },
    { ...probes.firestore, required: true },
    { ...probes.odoo, required: true },
    { ...probes.rateLimiter, required: true },
    { ...probes.mongo, required: isMongoUsersEnabled() },
    {
      name: 'mongo-identity',
      required: isMongoUsersEnabled(),
      ok: mongoIdentityReady().ok,
      message: mongoIdentityReady().message,
    },
    {
      name: 'queues',
      required: false,
      ok: !flags.lineWebhookAsync || flags.redisConfigured,
      message: flags.lineWebhookAsync
        ? (flags.redisConfigured ? 'BullMQ Redis configured' : 'Async LINE requested without Redis')
        : 'LINE webhook is synchronous (default)',
    },
  ];

  const envAudit = auditEnvParams(flags.appEnv);
  return {
    ready: checks.filter(check => check.required).every(check => check.ok),
    flags,
    checks,
    env: envAudit,
    modules: getServiceModules(),
    warnings: collectWarnings(flags, checks),
    identityChain: 'LINE identity -> profile SoR -> odooVerified -> ADMIN_USER_ID -> Odoo admin capability -> role',
    uptimeSeconds: Number(process.uptime().toFixed(0)),
    timestamp: new Date().toISOString(),
  };
};
