import { FormEvent, useEffect, useState } from 'react';

import { CopyField, Steps } from './ui';

type ApiFn = (path: string, init?: RequestInit) => Promise<Response>;

type ModuleRow = {
  id?: string;
  name: string;
  status: string;
  audience: string;
  store: string;
  adminLeaf?: string;
  demoTalkTrack: string;
  commands?: string[];
};

type PlatformPayload = {
  stores?: { firestore?: string; odoo?: string; mongo?: string };
  demoDayScript?: string[];
  modules?: ModuleRow[];
  error?: string;
  flags?: { appEnv?: string };
};

const platformPayload = (raw: unknown): PlatformPayload | null => {
  if (!raw || typeof raw !== 'object') return null;
  if (Array.isArray(raw)) return { modules: raw as ModuleRow[] };
  const rec = raw as PlatformPayload;
  if (Array.isArray(rec.modules) || rec.stores || rec.demoDayScript) return rec;
  return null;
};

const payloadHasContent = (data: PlatformPayload | null): data is PlatformPayload =>
  Boolean(data && (data.modules?.length || data.stores || data.demoDayScript?.length));

const PRICING_FIELDS = [
  'aiInputCostPer1MUsd', 'aiOutputCostPer1MUsd', 'lineMessageCostUsd',
  'odooRpcCostUsd', 'firestoreReadCostUsd', 'firestoreWriteCostUsd',
  'infraFixedMonthlyUsd', 'supportPerCustomerMonthlyUsd', 'monthlyBudgetCapUsd',
  'baseMarkupPercent', 'advancedMarkupPercent', 'enterpriseMarkupPercent',
  'riskBufferPercent', 'targetGrossMarginPercent', 'expectedCustomers',
] as const;

const pretty = (value: unknown): string => JSON.stringify(value, null, 2);

export const DemoPanel = ({ adminBase, api, go }: { adminBase: string; api: ApiFn; go: (href: string) => void }) => {
  const demoApi = `${adminBase}/api/demo`;
  const [out, setOut] = useState<Record<string, string>>({});
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [stores, setStores] = useState('Loading module map...');
  const [script, setScript] = useState('');
  const [chatUser, setChatUser] = useState('web_demo_user');
  const [chatText, setChatText] = useState('');
  const [transcript, setTranscript] = useState<Array<{ kind: string; text: string }>>([]);
  const [pricing, setPricing] = useState<Record<string, string>>({});
  const [writesEnabled, setWritesEnabled] = useState(false);
  const [journey, setJourney] = useState({
    userId: 'web_demo_user',
    language: 'en',
    customerName: 'Demo Partner',
    customerPhone: '+66000000000',
    customerEmail: '',
    productQuery: 'App',
    qty: '1',
  });

  const note = (key: string, value: unknown) => setOut(prev => ({ ...prev, [key]: typeof value === 'string' ? value : pretty(value) }));

  const loadJson = async (path: string) => {
    const res = await api(path);
    const body = await res.json();
    if (!res.ok) throw new Error((body as { error?: string }).error || pretty(body));
    return body;
  };

  useEffect(() => {
    void (async () => {
      try {
        let liveModules: ModuleRow[] = [];
        const liveRes = await api(`${adminBase}/api/live/modules`);
        const liveBody = await liveRes.json().catch(() => ({})) as PlatformPayload & { modules?: ModuleRow[] };
        if (liveRes.ok && Array.isArray(liveBody.modules) && liveBody.modules.length) {
          liveModules = liveBody.modules;
        }
        const demoRes = await api(`${demoApi}/platform`);
        const demoBody = await demoRes.json().catch(() => ({})) as PlatformPayload;
        const fromDemo = demoRes.ok ? platformPayload(demoBody) : null;
        const demoNote = demoRes.ok
          ? (payloadHasContent(fromDemo) ? '' : 'Demo platform returned no modules, stores, or script.')
          : (demoBody.error || `Demo platform HTTP ${demoRes.status}.`);
        let fromSettings: PlatformPayload | null = null;
        let settingsNote = '';
        if (!payloadHasContent(fromDemo)) {
          try {
            const settings = await loadJson(`${adminBase}/api/settings`) as { modules?: unknown; error?: string };
            fromSettings = platformPayload(settings.modules);
            if (!payloadHasContent(fromSettings)) {
              settingsNote = settings.error || 'Settings modules payload was empty.';
            }
          } catch (error) {
            settingsNote = error instanceof Error ? error.message : String(error);
          }
        }
        const data = payloadHasContent(fromDemo) ? fromDemo : fromSettings;
        if (!payloadHasContent(data) && !liveModules.length) {
          throw new Error([demoNote, settingsNote].filter(Boolean).join(' ') || 'No module inventory to show.');
        }
        if (data) {
          setStores(`Firestore: ${data.stores?.firestore || '—'} · Odoo: ${data.stores?.odoo || '—'} · Mongo: ${data.stores?.mongo || '—'}`);
          setScript((data.demoDayScript || []).map((step, i) => `${i + 1}. ${step}`).join('\n'));
        } else {
          setStores('Live module pages loaded. Demo talk track unavailable on this host.');
        }
        setModules(liveModules.length ? liveModules : (data?.modules || []));
        const appEnv = (demoBody as PlatformPayload).flags?.appEnv;
        setWritesEnabled(appEnv === 'development' || appEnv === 'staging');
      } catch (error) {
        setStores(String(error));
      }
    })();
  }, [adminBase, demoApi]);

  const sendChat = async (event: FormEvent) => {
    event.preventDefault();
    const text = chatText.trim();
    if (!text) return;
    setChatText('');
    setTranscript(prev => [...prev, { kind: 'user', text }]);
    const res = await api(`${demoApi}/chat`, { method: 'POST', body: JSON.stringify({ text, userId: chatUser }) });
    const body = await res.json() as { transcript?: Array<{ kind: string; text: string }>; error?: string };
    if (!res.ok) {
      setTranscript(prev => [...prev, { kind: 'text', text: body.error || 'Chat failed' }]);
      return;
    }
    setTranscript(prev => [...prev, ...(body.transcript || [])]);
  };

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <div className="card">
        <h2>Demo</h2>
        <p>
          Catalogue and talk track for Admin testing. Live LINE/Odoo data is on Work pages (Products, Catalog, CRM, Group-buy, Approvals, Reporting). Chat, journey, and pricing save stay off in production.
        </p>
        {!writesEnabled ? <p className="warn">This host is production: read-only inventory. Use staging Admin (<code>/admin/test</code>) or local development for web chat and journey writes.</p> : null}
        <nav className="demo-jump">
          {([
            ['demo-modules', 'Modules'],
            ['demo-ops', 'Ops'],
            ['demo-chat', 'Chat'],
            ['demo-pricing', 'Pricing'],
            ['demo-journey', 'Journey'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" className="secondary" onClick={() => jump(id)}>{label}</button>
          ))}
        </nav>
      </div>
      <div className="card" id="demo-modules">
        <h2>Service modules (catalogue)</h2>
        <p>{stores}</p>
        <div className="module-grid">
          {modules.map(mod => (
            <div className="module-card" key={mod.id || mod.name}>
              <h3>{mod.name} ({mod.status})</h3>
              <p>{mod.audience} · store: {mod.store}</p>
              <p>{mod.demoTalkTrack}</p>
              <code>{(mod.commands || []).slice(0, 4).join(' · ')}</code>
              {mod.adminLeaf ? (
                <div className="row">
                  <button type="button" onClick={() => go(`${adminBase}/${mod.adminLeaf}`)}>Open live page</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <CopyField label="Demo talk track" value={script || 'Talk track loads with the module map.'} />
      </div>
      <div className="overview-grid">
        <div className="card" id="demo-ops">
          <h2>Operations</h2>
          <div className="row">
            <button type="button" onClick={async () => {
              try { note('connections', await loadJson(`${demoApi}/connections`)); }
              catch (error) { note('connections', String(error)); }
            }}>Refresh connections</button>
            <button type="button" className="secondary" onClick={async () => {
              try { note('audit', await loadJson(`${demoApi}/workflow-audit`)); }
              catch (error) { note('audit', String(error)); }
            }}>Workflow audit</button>
          </div>
          <CopyField label="Connections" value={out.connections || 'Not loaded.'} />
          <CopyField label="Audit" value={out.audit || 'Audit not run.'} />
        </div>
        <div className="card">
          <h2>Runbook</h2>
          <Steps items={[
            <>Refresh connections: LINE, Firestore, Odoo.</>,
            <>Web chat uses the real command router.</>,
            <>FORM QUOTE CREATE writes an Odoo quotation.</>,
            <>Journey + LINE simulator below.</>,
          ]} />
        </div>
      </div>
      <div className="card" id="demo-chat">
        <h2>Web chat</h2>
        <div className="field-row">
          <div className="field">
            <label>LINE / demo user id</label>
            <input value={chatUser} onChange={e => setChatUser(e.target.value)} />
          </div>
        </div>
        <div className="chat-log">
          {transcript.map((row, i) => (
            <p key={i} className={row.kind === 'user' ? 'chat-user' : ''}><strong>{row.kind === 'user' ? 'You' : 'Sora'}:</strong> {row.text}</p>
          ))}
        </div>
        <form className="field-row" onSubmit={e => void sendChat(e)}>
          <div className="field" style={{ flex: '1 1 16rem' }}>
            <label>Message</label>
            <input value={chatText} onChange={e => setChatText(e.target.value)} placeholder="FORM QUOTE CREATE or NAV HOME" />
          </div>
          <button type="submit" disabled={!writesEnabled}>Send</button>
        </form>
      </div>
      <div className="card" id="demo-pricing">
        <h2>Pricing</h2>
        <div className="row">
          <button type="button" onClick={async () => {
            try {
              const data = await loadJson(`${demoApi}/pricing-model`) as { model?: Record<string, number> };
              const next: Record<string, string> = {};
              for (const key of PRICING_FIELDS) next[key] = String(data.model?.[key] ?? '');
              setPricing(next);
              note('pricing', data);
            } catch (error) { note('pricing', String(error)); }
          }}>Load model</button>
          <button type="button" disabled={!writesEnabled} onClick={async () => {
            const payload: Record<string, number> = {};
            for (const key of PRICING_FIELDS) payload[key] = Number(pricing[key] || 0);
            const res = await api(`${demoApi}/pricing-model`, { method: 'PUT', body: JSON.stringify(payload) });
            note('pricing', await res.json());
          }}>Save model</button>
          <button type="button" className="secondary" disabled={!writesEnabled} onClick={async () => {
            const payload: Record<string, number> = {};
            for (const key of PRICING_FIELDS) payload[key] = Number(pricing[key] || 0);
            const res = await api(`${demoApi}/pricing-simulation`, { method: 'POST', body: JSON.stringify(payload) });
            note('sim', await res.json());
          }}>Simulate</button>
        </div>
        <div className="field-row">
          {PRICING_FIELDS.map(key => (
            <div className="field" key={key}>
              <label>{key}</label>
              <input value={pricing[key] || ''} onChange={e => setPricing(prev => ({ ...prev, [key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <CopyField label="Pricing JSON" value={out.pricing || out.sim || 'Load a model to begin.'} />
      </div>
      <div className="card" id="demo-journey">
        <h2>Journey + LINE simulator</h2>
        <div className="field-row">
          {(['userId', 'language', 'customerName', 'customerPhone', 'productQuery', 'qty'] as const).map(key => (
            <div className="field" key={key}>
              <label>{key}</label>
              <input value={journey[key]} onChange={e => setJourney(prev => ({ ...prev, [key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div className="row">
          <button type="button" disabled={!writesEnabled} onClick={async () => {
            const res = await api(`${demoApi}/journey`, { method: 'POST', body: JSON.stringify({ ...journey, qty: Number(journey.qty), seedOdoo: true }) });
            note('journey', await res.json());
          }}>Run journey</button>
          <button type="button" className="secondary" disabled={!writesEnabled} onClick={async () => {
            const res = await fetch('/webhook-test', {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ userId: journey.userId, text: `PRODUCT FIND ${journey.productQuery}` }),
            });
            note('line', await res.json());
          }}>POST /webhook-test</button>
        </div>
        <CopyField label="Journey / webhook-test JSON" value={out.journey || out.line || 'Run a journey to see output.'} />
      </div>
    </>
  );
};
