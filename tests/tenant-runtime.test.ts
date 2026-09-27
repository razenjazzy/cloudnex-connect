import { describe, expect, it } from 'vitest';
import { describeTenantRuntime } from '../src/platform/tenant-runtime';

describe('tenant runtime silo', () => {
  it('never treats TENANT_KEY as a second ERP', async () => {
    const snap = await describeTenantRuntime();
    expect(snap.model).toBe('silo');
    expect(snap.isolation.overlay).toMatch(/overlay/i);
    expect(snap.isolation.odoo).toMatch(/getErpAdapter/);
    expect(snap.plans.map(plan => plan.id)).toEqual(['core', 'sales', 'enterprise']);
    expect(snap.customerCommerce.requested).toBe('quote');
    expect(snap.customerCommerce.effective).toBe('quote');
    expect(JSON.stringify(snap.customerCommerce)).not.toMatch(/https?:\/\//);
    expect(JSON.stringify(snap)).not.toMatch(/\/shop\/cart/);
  });
});
