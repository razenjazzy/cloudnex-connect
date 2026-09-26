import { FormEvent, useEffect, useState } from 'react';

type ApiFn = (path: string, init?: RequestInit) => Promise<Response>;

type ModuleRow = {
  name: string;
  status: string;
  audience: string;
  store: string;
  demoTalkTrack: string;
  commands?: string[];
};

const PRICING_FIELDS = [
  'aiInputCostPer1MUsd', 'aiOutputCostPer1MUsd', 'lineMessageCostUsd',
  'odooRpcCostUsd', 'firestoreReadCostUsd', 'firestoreWriteCostUsd',
  'infraFixedMonthlyUsd', 'supportPerCustomerMonthlyUsd', 'monthlyBudgetCapUsd',
  'baseMarkupPercent', 'advancedMarkupPercent', 'enterpriseMarkupPercent',
  'riskBufferPercent', 'targetGrossMarginPercent', 'expectedCustomers',
] as const;

const pretty = (value: unknown): string => JSON.stringify(value, null, 2);

export const DemoPanel = ({ adminBase, api }: { adminBase: string; api: ApiFn }) => {
  const demoApi = `${adminBase}/api/demo`;
  const [out, setOut] = useState<Record<string, string>>({});
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [stores, setStores] = useState('Loading module map...');
  const [script, setScript] = useState('');
  const [chatUser, setChatUser] = useState('web_demo_user');
  const [chatText, setChatText] = useState('');
  const [transcript, setTranscript] = useState<Array<{ kind: string; text: string }>>([]);
  const [pricing, setPricing] = useState<Record<string, string>>({});
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
        const data = await loadJson(`${demoApi}/platform`) as {
          stores?: { firestore?: string; odoo?: string; mongo?: string };
          demoDayScript?: string[];
          modules?: ModuleRow[];
        };
        setStores(`Firestore: ${data.stores?.firestore || '—'} · Odoo: ${data.stores?.odoo || '—'} · Mongo: ${data.stores?.mongo || '—'}`);
        setScript((data.demoDayScript || []).map((step, i) => `${i + 1}. ${step}`).join('\n'));
        setModules(data.modules || []);
      } catch (error) {
        setStores(String(error));
      }
    })();
  }, [demoApi]);

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

  return (
    <>
      <div className="card">
        <h2>Demo</h2>
        <p>Same <code>resolveCommandReply</code> as LINE. Off when APP_ENV=production. OPS session is enough — no separate demo token.</p>
        <nav className="demo-jump">
          <a href="#demo-modules">Modules</a>
          <a href="#demo-ops">Ops</a>
          <a href="#demo-chat">Chat</a>
          <a href="#demo-pricing">Pricing</a>
          <a href="#demo-journey">Journey</a>
        </nav>
      </div>
      <div className="card" id="demo-modules">
        <h2>Service modules</h2>
        <p>{stores}</p>
        <div className="module-grid">
          {modules.map(mod => (
            <div className="module-card" key={mod.name}>
              <h3>{mod.name} ({mod.status})</h3>
              <p>{mod.audience} · store: {mod.store}</p>
              <p>{mod.demoTalkTrack}</p>
              <code>{(mod.commands || []).slice(0, 4).join(' · ')}</code>
            </div>
          ))}
        </div>
        <CopyPre value={script || 'Talk track loads with the module map.'} />
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
          <CopyPre value={out.connections || 'Not loaded.'} />
          <CopyPre value={out.audit || 'Audit not run.'} />
        </div>
        <div className="card">
          <h2>Runbook</h2>
          <ol className="howto">
            <li>Refresh connections: LINE, Firestore, Odoo.</li>
            <li>Web chat uses the real command router.</li>
            <li>FORM QUOTE CREATE writes an Odoo quotation.</li>
            <li>Journey + LINE simulator below.</li>
          </ol>
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
          <button type="submit">Send</button>
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
          <button type="button" onClick={async () => {
            const payload: Record<string, number> = {};
            for (const key of PRICING_FIELDS) payload[key] = Number(pricing[key] || 0);
            const res = await api(`${demoApi}/pricing-model`, { method: 'PUT', body: JSON.stringify(payload) });
            note('pricing', await res.json());
          }}>Save model</button>
          <button type="button" className="secondary" onClick={async () => {
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
        <CopyPre value={out.pricing || out.sim || 'Load a model to begin.'} />
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
          <button type="button" onClick={async () => {
            const res = await api(`${demoApi}/journey`, { method: 'POST', body: JSON.stringify({ ...journey, qty: Number(journey.qty), seedOdoo: true }) });
            note('journey', await res.json());
          }}>Run journey</button>
          <button type="button" className="secondary" onClick={async () => {
            const res = await fetch('/webhook-test', {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ userId: journey.userId, text: `PRODUCT FIND ${journey.productQuery}` }),
            });
            note('line', await res.json());
          }}>POST /webhook-test</button>
        </div>
        <CopyPre value={out.journey || out.line || 'Run a journey to see output.'} />
      </div>
    </>
  );
};

const CopyPre = ({ value }: { value: string }) => (
  <pre><code>{value}</code></pre>
);
