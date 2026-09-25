import { executeKwRead, getOdooConfig, loginRead } from './client';

export type OdooCommerceStatus = {
  ok: boolean;
  module?: string;
  message: string;
};

const installedModule = async (names: string[]): Promise<string | undefined> => {
  const config = getOdooConfig();
  if (!config) return undefined;
  const uid = await loginRead(config);
  if (!uid) return undefined;
  const rows = await executeKwRead<Array<{ name?: string }>>(
    config,
    uid,
    'ir.module.module',
    'search_read',
    [[['name', 'in', names], ['state', '=', 'installed']]],
    { fields: ['name'], limit: 1 },
  ).catch(() => [] as Array<{ name?: string }>);
  const name = rows[0]?.name;
  return typeof name === 'string' ? name : undefined;
};

export const describeOdooSignatureStatus = async (): Promise<OdooCommerceStatus> => {
  if (!getOdooConfig()) return { ok: false, message: 'Odoo is not configured.' };
  try {
    const module = await installedModule(['sign', 'documents_sign', 'sign_oca']);
    if (!module) return { ok: false, message: 'Odoo e-sign module is not installed.' };
    return { ok: true, module, message: 'E-sign module is installed.' };
  } catch {
    return { ok: false, message: 'Could not query Odoo e-sign modules.' };
  }
};

export const describeOdooPaymentStatus = async (): Promise<OdooCommerceStatus> => {
  if (!getOdooConfig()) return { ok: false, message: 'Odoo is not configured.' };
  try {
    const module = await installedModule(['account', 'account_payment', 'payment']);
    if (!module) return { ok: false, message: 'Odoo payment/accounting module is not installed.' };
    return { ok: true, module, message: 'Payment status is available from invoices (no card data stored).' };
  } catch {
    return { ok: false, message: 'Could not query Odoo payment modules.' };
  }
};
