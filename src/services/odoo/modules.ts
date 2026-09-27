import { executeKwRead, getOdooConfig, loginRead } from './client';

const MODULE_PROBE_TTL_MS = 15_000;

type ModuleProbeCache = {
  websiteSaleInstalled: boolean;
  saleInstalled: boolean;
  at: number;
};

let moduleProbeCache: ModuleProbeCache | null = null;

export type OdooSaleModuleProbe = {
  websiteSaleInstalled: boolean;
  saleInstalled: boolean;
  odooOk: boolean;
};

export const probeOdooSaleModules = async (): Promise<OdooSaleModuleProbe> => {
  const config = getOdooConfig();
  if (!config) return { websiteSaleInstalled: false, saleInstalled: false, odooOk: false };
  if (moduleProbeCache && Date.now() - moduleProbeCache.at < MODULE_PROBE_TTL_MS) {
    return {
      websiteSaleInstalled: moduleProbeCache.websiteSaleInstalled,
      saleInstalled: moduleProbeCache.saleInstalled,
      odooOk: true,
    };
  }
  try {
    const uid = await loginRead(config);
    const rows = await executeKwRead<Record<string, unknown>[]>(
      config,
      uid,
      'ir.module.module',
      'search_read',
      [[['name', 'in', ['website_sale', 'sale']]]],
      { fields: ['name', 'state'], limit: 8 },
    );
    const installed = (name: string): boolean =>
      (rows || []).some(row => String(row.name || '') === name && String(row.state || '') === 'installed');
    const next = {
      websiteSaleInstalled: installed('website_sale'),
      saleInstalled: installed('sale'),
      at: Date.now(),
    };
    moduleProbeCache = next;
    return {
      websiteSaleInstalled: next.websiteSaleInstalled,
      saleInstalled: next.saleInstalled,
      odooOk: true,
    };
  } catch {
    return { websiteSaleInstalled: false, saleInstalled: false, odooOk: false };
  }
};
