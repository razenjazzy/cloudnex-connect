import { FormEvent, useEffect, useState } from 'react';

import { CopyField, Steps } from './ui';

type ApiFn = (path: string, init?: RequestInit) => Promise<Response>;

type TenantSnap = {
  tenantKey?: string;
  model?: string;
  isolation?: Record<string, string>;
  odoo?: { configured?: boolean; host?: string | null; db?: string | null };
  line?: { default?: boolean; sales?: boolean; customer?: boolean };
  customisation?: {
    enabledServices?: string | null;
    disabledCommands?: string | null;
    agentEn?: string;
    agentTh?: string;
  };
  customerCommerce?: {
    requested?: string;
    effective?: string;
    websiteSaleInstalled?: boolean;
    websiteIdSet?: boolean;
    degraded?: boolean;
    degradeReason?: string;
  };
  lock?: boolean;
  plans?: Array<{ id: string; name: string; includes: string }>;
  error?: string;
};

export const formatCustomerCommerceRow = (cc?: TenantSnap['customerCommerce']): string => {
  if (!cc) return '—';
  const degraded = cc.degraded
    ? ` (degraded${cc.degradeReason ? `: ${cc.degradeReason}` : ''})`
    : '';
  return `${cc.requested} → ${cc.effective}${degraded}; website_sale ${cc.websiteSaleInstalled ? 'yes' : 'no'}; website id ${cc.websiteIdSet ? 'set' : 'unset'}`;
};

export const TenantPanel = ({
  adminBase,
  api,
  go,
  toast,
}: {
  adminBase: string;
  api: ApiFn;
  go: (href: string) => void;
  toast: (text: string, kind?: 'ok' | 'error') => void;
}) => {
  const [snap, setSnap] = useState<TenantSnap | null>(null);
  const [tenantKey, setTenantKey] = useState('default');
  const [error, setError] = useState('');

  const load = async () => {
    const res = await api(`${adminBase}/api/tenant`);
    const body = await res.json() as TenantSnap;
    if (!res.ok) {
      setError(body.error || 'Could not load tenant.');
      return;
    }
    setSnap(body);
    if (body.tenantKey) setTenantKey(body.tenantKey);
    setError('');
  };

  useEffect(() => {
    void load();
  }, [adminBase]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const res = await api(`${adminBase}/api/tenant`, { method: 'PUT', body: JSON.stringify({ tenantKey }) });
    const body = await res.json() as { tenantKey?: string; error?: string };
    if (!res.ok) {
      toast(body.error || 'Tenant save failed (lock?)');
      setError(body.error || 'Tenant save failed (lock?)');
      return;
    }
    setTenantKey(body.tenantKey || tenantKey);
    toast('Tenant key saved', 'ok');
    await load();
  };

  return (
    <>
      {error ? <p className="warn">{error}</p> : null}
      <div className="card">
        <h2>Tenants / subscription</h2>
        <p className="page-lead">
          This Admin and HMAC process is <strong>one client silo</strong>. A second paying company gets its own deploy (own <code>.env</code>, own Odoo, own LINE secrets), not a second row in a shared Odoo.
        </p>
        <Steps items={[
          <>Keep Sales and Customer OAs on this process only for this client.</>,
          <>Point <code>ODOO_*</code> at that client’s database (or a lab copy for tests).</>,
          <>Use <code>TENANT_KEY</code> to isolate overlay labels — it does not switch Odoo.</>,
        ]} />
        <p className="muted">Model: {snap?.model || '—'} · overlay lock: {String(snap?.lock ?? '—')}</p>
        <form className="field-row" onSubmit={save}>
          <div className="field">
            <label>Overlay TENANT_KEY</label>
            <input value={tenantKey} onChange={e => setTenantKey(e.target.value)} placeholder="default" />
          </div>
          <button type="submit" disabled={snap?.lock === true}>Save overlay key</button>
          <button type="button" className="secondary" onClick={() => void load()}>Reload</button>
          <button type="button" className="secondary" onClick={() => go(`${adminBase}/platform`)}>ERP probe</button>
        </form>
        {snap?.lock ? <p className="warn">ADMIN_CONFIG_LOCK is on. Change TENANT_KEY in VPS <code>.env</code> and recreate the container, or set lock false with SECRETS_ENCRYPTION_KEY.</p> : null}
      </div>
      <div className="card">
        <h2>This process</h2>
        <table>
          <thead><tr><th>Bound to</th><th>Live</th></tr></thead>
          <tbody>
            <tr><td>Odoo host</td><td>{snap?.odoo?.configured ? `${snap.odoo.host || '—'} / db ${snap.odoo.db || '—'}` : 'not configured'}</td></tr>
            <tr><td>LINE default / sales / customer</td><td>{String(snap?.line?.default)} / {String(snap?.line?.sales)} / {String(snap?.line?.customer)}</td></tr>
            <tr><td>ENABLED_SERVICES</td><td>{snap?.customisation?.enabledServices || 'all keys allowed by env'}</td></tr>
            <tr><td>DISABLED_COMMANDS</td><td>{snap?.customisation?.disabledCommands || '—'}</td></tr>
            <tr><td>Agent</td><td>{snap?.customisation?.agentEn || '—'} / {snap?.customisation?.agentTh || '—'}</td></tr>
            <tr><td>Customer commerce</td><td>{formatCustomerCommerceRow(snap?.customerCommerce)}</td></tr>
          </tbody>
        </table>
        {snap?.isolation ? <CopyField label="Isolation rules" value={Object.entries(snap.isolation).map(([k, v]) => `${k}: ${v}`).join('\n')} /> : null}
      </div>
      <div className="card">
        <h2>Test Odoo with the current Official Accounts</h2>
        <p className="page-lead">Keep LINE secrets and webhook URLs. Swap only the ERP database this process calls.</p>
        <Steps items={[
          <>Create a lab Odoo (Odoo.sh staging, Docker, or a copy DB). Add a dedicated API user with partner / product / sale.order access. Put products and at least one partner with a phone you can VERIFY.</>,
          <>On the <strong>same</strong> HMAC host, set <code>ODOO_URL</code>, <code>ODOO_DB</code>, <code>ODOO_USERNAME</code>, <code>ODOO_API_KEY</code> to that lab. Leave <code>LINE_CHANNEL_*</code> unchanged so Sales/Customer webhooks stay on this OA.</>,
          <>Recreate the container (runtime reads env at start). Admin → ERP → Refresh. <code>PRODUCT FIND</code> and Home must show lab prices, not production.</>,
          <>Firestore still stores <code>odooPartnerId</code> from the previous DB. Re-VERIFY on LINE (or use a fresh LINE tester) so partner ids match the lab. Overlay <code>TENANT_KEY</code> does not remap partners.</>,
        ]} />
        <p className="muted">Do not point production HMAC at a lab Odoo if live shoppers are on that OA. Use staging sibling <code>/opt/cns-line-oa</code> with a duplicate OA or the same OA only during a freeze.</p>
      </div>
      <div className="card">
        <h2>Packaging (silo SKUs)</h2>
        <p className="page-lead">Entitlements are env and overlay on that client’s process — not a shared multi-tenant billing engine in this cut.</p>
        <table>
          <thead><tr><th>Plan</th><th>What you ship</th></tr></thead>
          <tbody>
            {(snap?.plans || []).map(plan => (
              <tr key={plan.id}><td>{plan.name}</td><td>{plan.includes}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="row">
          <button type="button" className="secondary" onClick={() => go(`${adminBase}/settings`)}>Service toggles</button>
          <button type="button" className="secondary" onClick={() => go(`${adminBase}/commands`)}>Command overlay</button>
          <button type="button" className="secondary" onClick={() => go(`${adminBase}/line`)}>LINE channels</button>
        </div>
      </div>
    </>
  );
};
