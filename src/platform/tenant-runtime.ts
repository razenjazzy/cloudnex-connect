import { resolveChannelConfig } from '../line/channels';
import { getOdooConfig } from '../services/odoo/client';
import { getRuntime, isAdminConfigLocked } from '../services/runtime-settings';
import { getActiveTenantKey } from '../services/tenant';
import { resolveCustomerCommerce } from './customer-commerce';

const odooHostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return 'configured';
  }
};

/**
 * This process is one paying client (silo). Overlay TENANT_KEY is not a second Odoo.
 */
export const describeTenantRuntime = async () => {
  const odoo = getOdooConfig();
  const customerCommerce = await resolveCustomerCommerce();
  return {
    tenantKey: getActiveTenantKey(),
    model: 'silo' as const,
    isolation: {
      process: 'One Cloudnex Connect process equals one client (or one lab). Do not load a second company LINE OA onto this HMAC.',
      odoo: 'Single ODOO_URL and ODOO_DB per process via getErpAdapter(). Mongo is never Odoo SoR.',
      line: 'LINE_CHANNEL_* on this process. Sales and Customer are this client’s OAs, not other subscribers.',
      overlay: 'TENANT_KEY only scopes Firestore overlay docs (commands, i18n, channel service overrides).',
      identity: 'LINE profiles live in this process’s Firestore project (Mongo only if MONGO_USERS). Partner ids are for the Odoo DB currently configured.',
    },
    odoo: {
      configured: Boolean(odoo),
      host: odoo ? odooHostOf(odoo.url) : null,
      db: odoo?.db || null,
    },
    line: {
      default: Boolean(resolveChannelConfig('default')),
      sales: Boolean(resolveChannelConfig('sales')),
      customer: Boolean(resolveChannelConfig('customer')),
    },
    customisation: {
      enabledServices: getRuntime('ENABLED_SERVICES') || null,
      disabledCommands: getRuntime('DISABLED_COMMANDS') || null,
      agentEn: getRuntime('LINE_AGENT_NAME_EN') || 'Sora',
      agentTh: getRuntime('LINE_AGENT_NAME_TH') || 'โซระ',
    },
    customerCommerce: {
      requested: customerCommerce.requested,
      effective: customerCommerce.effective,
      websiteSaleInstalled: customerCommerce.websiteSaleInstalled,
      websiteIdSet: customerCommerce.websiteIdSet,
      degraded: customerCommerce.degraded,
      ...(customerCommerce.degradeReason ? { degradeReason: customerCommerce.degradeReason } : {}),
    },
    lock: isAdminConfigLocked(),
    plans: [
      { id: 'core', name: 'Connect Core', includes: 'Identity, commerce Home, product catalogue, quotations' },
      { id: 'sales', name: 'Connect Sales', includes: 'Core plus directory, reporting, campaigns, Sales OA admin commands' },
      { id: 'enterprise', name: 'Connect Enterprise', includes: 'Silo deploy, overlay, SLA; custom handlers stay in the product repo as flags, not a public fork' },
    ],
  };
};
