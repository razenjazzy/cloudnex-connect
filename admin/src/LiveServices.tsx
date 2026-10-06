import { FormEvent, useEffect, useState } from 'react';

import { CopyField, FaqRunbook } from './ui';

type ApiFn = (path: string, init?: RequestInit) => Promise<Response>;

type ProductRow = {
  id: number;
  name: string;
  sku?: string;
  price?: number;
  quantity?: number;
  description?: string;
  hasPhoto?: boolean;
};

type ServiceRow = {
  id: number;
  name: string;
  sku?: string;
  price: number;
  quantity?: number;
};

type GroupBuyRow = {
  id: string;
  status?: string;
  productQuery?: string;
  productName?: string;
  targetQty?: number;
  joinedQty?: number;
  creatorUserId?: string;
  odooOrderRef?: string;
  createdAt?: string;
};

type ApprovalRow = {
  id?: string;
  commandId?: string;
  status?: string;
  actorUserId?: string;
  targetId?: string;
  createdAt?: string;
};

type ReportRow = {
  product?: string;
  stock?: number;
  salesYesterday?: number;
  revenueYesterday?: number;
};

type LivePage = 'commerce' | 'catalog' | 'group-buy' | 'approvals' | 'ops' | 'reporting';

const pretty = (value: unknown): string => JSON.stringify(value, null, 2);

export const LiveServices = ({
  page,
  adminBase,
  api,
  go,
}: {
  page: LivePage;
  adminBase: string;
  api: ApiFn;
  go: (href: string) => void;
}) => {
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [groupBuys, setGroupBuys] = useState<GroupBuyRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [flags, setFlags] = useState<Record<string, unknown>>({});
  const [toggles, setToggles] = useState<Array<{ key: string; effective: boolean; source: string }>>([]);

  const loadModules = async () => {
    const res = await api(`${adminBase}/api/live/modules`);
    const body = await res.json() as { flags?: Record<string, unknown>; toggles?: Array<{ key: string; effective: boolean; source: string }>; error?: string };
    if (!res.ok) {
      setError(body.error || 'Could not load live modules.');
      return;
    }
    setFlags(body.flags || {});
    setToggles(body.toggles || []);
    setError('');
  };

  useEffect(() => {
    void (async () => {
      await loadModules();
      if (page === 'commerce') {
        const res = await api(`${adminBase}/api/live/products`);
        const body = await res.json() as { products?: ProductRow[]; error?: string };
        setProducts(body.products || []);
        if (!res.ok) setError(body.error || 'Odoo products unavailable.');
        return;
      }
      if (page === 'catalog') {
        const res = await api(`${adminBase}/api/live/services`);
        const body = await res.json() as { services?: ServiceRow[]; error?: string };
        setServices(body.services || []);
        if (!res.ok) setError(body.error || 'Odoo services unavailable.');
        return;
      }
      if (page === 'group-buy') {
        const res = await api(`${adminBase}/api/live/group-buys`);
        const body = await res.json() as { groupBuys?: GroupBuyRow[]; error?: string };
        setGroupBuys(body.groupBuys || []);
        if (!res.ok) setError(body.error || 'Group-buy list unavailable.');
        return;
      }
      if (page === 'approvals') {
        const res = await api(`${adminBase}/api/approvals?limit=50`);
        const body = await res.json() as { records?: ApprovalRow[]; error?: string };
        setApprovals(body.records || []);
        if (!res.ok) setError(body.error || 'Approvals unavailable.');
        return;
      }
      if (page === 'reporting') {
        const res = await api(`${adminBase}/api/live/report`);
        const body = await res.json() as { rows?: ReportRow[]; error?: string };
        setRows(body.rows || []);
        if (!res.ok) setError(body.error || 'Daily snapshot unavailable.');
      }
    })();
  }, [adminBase, page]);

  const searchProducts = async (event: FormEvent) => {
    event.preventDefault();
    const res = await api(`${adminBase}/api/live/products?q=${encodeURIComponent(query.trim())}`);
    const body = await res.json() as { products?: ProductRow[]; error?: string };
    setProducts(body.products || []);
    setError(res.ok ? '' : (body.error || 'Search failed'));
  };

  const gate = (key: string) => toggles.find(row => row.key === key);

  return (
    <>
      {error ? <p className="warn">{error}</p> : null}
      {page === 'commerce' ? (
        <div className="card">
          <h2>Products</h2>
          <p className="page-lead">Live Odoo <code>list_price</code> catalogue used by LINE PRODUCT FIND. Not the Demo pricing model. Quotes stay on Work → CRM.</p>
          <FaqRunbook
            title="How this page works"
            warn="This is live Odoo, not Demo pricing. A commerce gate off in env cannot be turned on from Admin."
            items={[
              <>Service gate <code>commerce</code>: {gate('commerce') ? `${gate('commerce')!.effective ? 'on' : 'off'} (${gate('commerce')!.source})` : '—'}. Change on Settings.</>,
              <>Odoo: {String(flags.odooConfigured ?? '—')}.</>,
            ]}
          />
          <form className="field-row" onSubmit={searchProducts}>
            <div className="field">
              <label>Search name or SKU</label>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="App Premium" />
            </div>
            <button type="submit">Search</button>
            <button type="button" className="secondary" onClick={() => go(`${adminBase}/crm`)}>Open quotes</button>
            <button type="button" className="secondary" onClick={() => go(`${adminBase}/settings`)}>Service toggles</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Id</th><th>Name</th><th>SKU</th><th>Price</th><th>Qty</th><th>LINE photo</th></tr></thead>
              <tbody>
                {products.map(row => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.name}</td>
                    <td>{row.sku || '—'}</td>
                    <td>{row.price ?? '—'}</td>
                    <td>{row.quantity ?? '—'}</td>
                    <td>{row.hasPhoto ? 'Photo' : 'Camera placeholder'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {products[0] ? <CopyField label="First product" value={pretty(products[0])} /> : null}
        </div>
      ) : null}
      {page === 'catalog' ? (
        <div className="card">
          <h2>Service catalog</h2>
          <p className="page-lead">Odoo service records for LINE <code>SERVICE LIST</code>. Not an Admin SKU editor — create/update stays on LINE FORM SERVICE *.</p>
          <FaqRunbook
            title="How this page works"
            warn="Create and update stay on LINE FORM SERVICE *. This table is read-only."
            items={[
              <>Gate <code>catalog</code>: {gate('catalog') ? `${gate('catalog')!.effective ? 'on' : 'off'} (${gate('catalog')!.source})` : '—'}.</>,
            ]}
          />
          <div className="row">
            <button type="button" onClick={async () => {
              const res = await api(`${adminBase}/api/live/services`);
              const body = await res.json() as { services?: ServiceRow[]; error?: string };
              setServices(body.services || []);
              setError(res.ok ? '' : (body.error || 'Reload failed'));
            }}>Reload</button>
            <button type="button" className="secondary" onClick={() => go(`${adminBase}/settings`)}>Service toggles</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Id</th><th>Name</th><th>SKU</th><th>Price</th><th>Qty</th></tr></thead>
              <tbody>
                {services.map(row => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.name}</td>
                    <td>{row.sku || '—'}</td>
                    <td>{row.price}</td>
                    <td>{row.quantity ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {page === 'group-buy' ? (
        <div className="card">
          <h2>Group-buy</h2>
          <p className="page-lead">Firestore sessions. Confirm still writes an Odoo quotation through LINE. Env <code>GROUPBUY_ENABLED</code> plus the <code>groupBuy</code> toggle must both allow it.</p>
          <FaqRunbook
            title="How this page works"
            warn="Confirm still writes an Odoo quotation through LINE. Env GROUPBUY_ENABLED plus the groupBuy toggle must both allow it."
            items={[
              <>Env GROUPBUY: {String(flags.groupBuyEnabled ?? '—')}.</>,
              <>Gate <code>groupBuy</code>: {gate('groupBuy') ? `${gate('groupBuy')!.effective ? 'on' : 'off'} (${gate('groupBuy')!.source})` : '—'}.</>,
            ]}
          />
          <div className="table-wrap">
            <table>
              <thead><tr><th>Id</th><th>Status</th><th>Product</th><th>Joined / target</th><th>Odoo</th><th>Creator</th></tr></thead>
              <tbody>
                {groupBuys.map(row => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.status || '—'}</td>
                    <td>{row.productName || row.productQuery || '—'}</td>
                    <td>{row.joinedQty ?? 0} / {row.targetQty ?? '—'}</td>
                    <td>{row.odooOrderRef || '—'}</td>
                    <td>{row.creatorUserId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {page === 'approvals' ? (
        <div className="card">
          <h2>Approvals</h2>
          <p className="page-lead">Step-up OTP and QUOTE APPROVE records from Firestore. LINE still owns the confirm flow.</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Id</th><th>Command</th><th>Status</th><th>Actor</th><th>Target</th><th>Created</th></tr></thead>
              <tbody>
                {approvals.map((row, i) => (
                  <tr key={String(row.id || i)}>
                    <td>{row.id || '—'}</td>
                    <td>{row.commandId || '—'}</td>
                    <td>{row.status || '—'}</td>
                    <td>{row.actorUserId || '—'}</td>
                    <td>{row.targetId || '—'}</td>
                    <td>{row.createdAt || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!approvals.length ? <p className="muted">No recent approval records.</p> : null}
        </div>
      ) : null}
      {page === 'ops' ? (
        <div className="card">
          <h2>Ops</h2>
          <p className="page-lead">Live flags for GraphQL, Swagger, queue, and ERP. Same process as HMAC. Demo Chat is still Testing only.</p>
          <table>
            <thead><tr><th>Flag</th><th>Value</th></tr></thead>
            <tbody>
              {Object.entries(flags).map(([key, value]) => (
                <tr key={key}><td><code>{key}</code></td><td>{String(value)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="row">
            <button type="button" className="secondary" onClick={() => go(`${adminBase}/jobs`)}>Jobs</button>
            <button type="button" className="secondary" onClick={() => go(`${adminBase}/advanced`)}>Advanced flags</button>
            <button type="button" className="secondary" onClick={() => go(`${adminBase}/platform`)}>ERP</button>
          </div>
        </div>
      ) : null}
      {page === 'reporting' ? (
        <div className="card">
          <h2>Reporting</h2>
          <p className="page-lead">Odoo daily sales snapshot. LINE <code>DAILY REPORT</code> and Jobs → daily-report push the Gemini summary to allowlisted admins.</p>
          <FaqRunbook
            title="How this page works"
            warn="LINE DAILY REPORT and Jobs → daily-report push to ADMIN_USER_ID. Empty rows mean Odoo is empty or unreachable."
            items={[
              <>Gate <code>reporting</code>: {gate('reporting') ? `${gate('reporting')!.effective ? 'on' : 'off'} (${gate('reporting')!.source})` : '—'}.</>,
            ]}
          />
          <div className="row">
            <button type="button" className="secondary" onClick={() => go(`${adminBase}/jobs`)}>Run jobs</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th>Stock</th><th>Sales yesterday</th><th>Revenue yesterday</th></tr></thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.product || i}`}>
                    <td>{row.product || '—'}</td>
                    <td>{row.stock ?? '—'}</td>
                    <td>{row.salesYesterday ?? '—'}</td>
                    <td>{row.revenueYesterday ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length ? <p className="muted">No snapshot rows (Odoo empty or unavailable).</p> : null}
        </div>
      ) : null}
    </>
  );
};
