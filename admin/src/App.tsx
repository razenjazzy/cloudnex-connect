import { FormEvent, useEffect, useMemo, useState } from 'react';

const TOKEN_KEY = 'cns_ops_token';

type Quote = {
  id: number;
  name: string;
  state: string;
  amountTotal: number;
  partnerName?: string;
  salespersonUserId?: number;
  salespersonName?: string;
  clientOrderRef?: string;
  dateOrder?: string;
};

const pathOf = (): string => {
  const raw = window.location.pathname.replace(/\/$/, '') || '/admin';
  return raw.startsWith('/admin') ? raw : '/admin';
};

const gql = async (query: string, variables?: Record<string, unknown>) => {
  const token = sessionStorage.getItem(TOKEN_KEY) || '';
  try {
    const res = await fetch('/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });
    return await res.json() as { data?: Record<string, unknown>; errors?: Array<{ message: string }> };
  } catch {
    return { errors: [{ message: 'GraphQL unavailable' }] };
  }
};

export const App = () => {
  const [path, setPath] = useState(pathOf);
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [stateFilter, setStateFilter] = useState('');
  const [unassigned, setUnassigned] = useState(false);
  const [assignId, setAssignId] = useState('');
  const [assignUid, setAssignUid] = useState('');

  useEffect(() => {
    const onPop = () => setPath(pathOf());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = (next: string) => {
    window.history.pushState({}, '', next);
    setPath(pathOf());
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    const next = token.trim();
    sessionStorage.setItem(TOKEN_KEY, next);
    const res = await fetch('/admin/crm/quotes', {
      credentials: 'include',
      headers: next ? { authorization: `Bearer ${next}` } : {},
    });
    if (res.status === 401) {
      setAuthed(false);
      setError('Unauthorized');
      return;
    }
    setAuthed(true);
    setError('');
  };

  const loadQuotes = async () => {
    const tokenHeader = sessionStorage.getItem(TOKEN_KEY) || '';
    const gqlResult = await gql(
      'query ($state: String, $unassigned: Boolean) { crmQuotes(state: $state, unassigned: $unassigned) }',
      { state: stateFilter || null, unassigned },
    );
    if (!gqlResult.errors) {
      const payload = gqlResult.data?.crmQuotes as { quotes?: Quote[] } | undefined;
      setQuotes(payload?.quotes || []);
      setError('');
      return;
    }
    const params = new URLSearchParams();
    if (stateFilter) params.set('state', stateFilter);
    if (unassigned) params.set('unassigned', '1');
    const res = await fetch(`/admin/crm/quotes?${params.toString()}`, {
      credentials: 'include',
      headers: tokenHeader ? { authorization: `Bearer ${tokenHeader}` } : {},
    });
    if (!res.ok) {
      setError(gqlResult.errors[0]?.message || res.statusText);
      return;
    }
    const payload = await res.json() as { quotes?: Quote[] };
    setQuotes(payload.quotes || []);
    setError('');
  };

  const assign = async (event: FormEvent) => {
    event.preventDefault();
    const id = Number(assignId);
    const salespersonUserId = assignUid.trim() === '' ? null : Number(assignUid);
    const result = await gql(
      'mutation ($id: Int!, $salespersonUserId: Int) { assignCrmQuote(id: $id, salespersonUserId: $salespersonUserId) }',
      { id, salespersonUserId },
    );
    if (result.errors?.[0]) {
      setError(result.errors[0].message);
      return;
    }
    setError('');
    await loadQuotes();
  };

  useEffect(() => {
    if (!authed || path !== '/admin/crm') return;
    void loadQuotes();
  }, [authed, path, stateFilter, unassigned]);

  const page = useMemo(() => {
    if (path === '/admin/crm') return 'crm';
    if (path === '/admin/demo') return 'demo';
    return 'home';
  }, [path]);

  if (!authed) {
    return (
      <main>
        <div className="card">
          <h1>Cloudnex Admin</h1>
          <p>OPS token required. Staging demo-session cookie also works when /demo is on.</p>
          <form className="row" onSubmit={login}>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="OPS_API_TOKEN"
              autoComplete="off"
            />
            <button type="submit">Sign in</button>
          </form>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <>
      <header>
        <strong>Cloudnex</strong>
        <a className={page === 'home' ? 'active' : ''} href="/admin" onClick={e => { e.preventDefault(); go('/admin'); }}>Home</a>
        <a className={page === 'demo' ? 'active' : ''} href="/admin/demo" onClick={e => { e.preventDefault(); go('/admin/demo'); }}>Demo hub</a>
        <a className={page === 'crm' ? 'active' : ''} href="/admin/crm" onClick={e => { e.preventDefault(); go('/admin/crm'); }}>CRM</a>
        <button className="secondary" type="button" onClick={() => { sessionStorage.removeItem(TOKEN_KEY); setAuthed(false); }}>Sign out</button>
      </header>
      <main>
        {error ? <p className="error">{error}</p> : null}
        {page === 'home' ? (
          <div className="card">
            <h2>Admin</h2>
            <p>Demo presenter stays at <a href="/demo">/demo</a> (off in production APP_ENV). LINE still uses one command router.</p>
            <div className="row">
              <button type="button" onClick={() => go('/admin/demo')}>Demo hub</button>
              <button type="button" onClick={() => go('/admin/crm')}>CRM quotes</button>
            </div>
          </div>
        ) : null}
        {page === 'demo' ? (
          <div className="card">
            <h2>Demo links</h2>
            <ul>
              <li><a href="/demo">/demo</a> presenter (staging / development)</li>
              <li><a href="/healthz">/healthz</a></li>
              <li><a href="/readyz">/readyz</a></li>
              <li><a href="/ops/platform">/ops/platform</a></li>
              <li><a href="/graphql">/graphql</a> GraphiQL when ENABLE_GRAPHQL</li>
            </ul>
            <p>LINE commands (paste in OA or /demo chat):</p>
            <p><code>NAV HOME</code> · <code>FORM QUOTE CREATE</code> · <code>FORM VERIFY</code> · <code>SALES FEATURES</code></p>
            <p>Reset: <code>VERIFY SIGNOUT</code> or form <code>CANCEL</code>. No Firestore wipe from this panel.</p>
          </div>
        ) : null}
        {page === 'crm' ? (
          <div className="card">
            <h2>Quotes (Odoo sale.order)</h2>
            <div className="row">
              <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
                <option value="">draft / sent / sale</option>
                <option value="draft">draft</option>
                <option value="sent">sent</option>
                <option value="sale">sale</option>
              </select>
              <label>
                <input type="checkbox" checked={unassigned} onChange={e => setUnassigned(e.target.checked)} /> unassigned
              </label>
              <button type="button" onClick={() => void loadQuotes()}>Refresh</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>State</th>
                  <th>Partner</th>
                  <th>Salesperson</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.id}>
                    <td>{q.name} ({q.id})</td>
                    <td>{q.state}</td>
                    <td>{q.partnerName || '—'}</td>
                    <td>{q.salespersonName || q.salespersonUserId || 'unassigned'}</td>
                    <td>{q.amountTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form className="row" onSubmit={assign}>
              <input value={assignId} onChange={e => setAssignId(e.target.value)} placeholder="quote id" />
              <input value={assignUid} onChange={e => setAssignUid(e.target.value)} placeholder="res.users id (blank = unassign)" />
              <button type="submit">Assign</button>
            </form>
          </div>
        ) : null}
      </main>
    </>
  );
};
