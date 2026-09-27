import { FormEvent, useEffect, useState } from 'react';

type StudioStatus = {
  ollama?: { configured?: boolean; model?: string };
  flowise?: { configured?: boolean };
};

type ApiFn = (path: string, init?: RequestInit) => Promise<Response>;

export const StudioPanel = ({ adminBase, api }: { adminBase: string; api: ApiFn }) => {
  const [engine, setEngine] = useState<'ollama' | 'flowise'>('ollama');
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<StudioStatus | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await api(`${adminBase}/api/studio`);
      if (!res.ok) return;
      setStatus(await res.json() as StudioStatus);
    })();
  }, [adminBase, api]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setOutput('…');
    const res = await api(`${adminBase}/api/studio`, {
      method: 'POST',
      body: JSON.stringify({ engine, prompt: text }),
    });
    const body = await res.json() as { text?: string; error?: string };
    setOutput(body.text || body.error || `HTTP ${res.status}`);
    setBusy(false);
  };

  const ollamaOn = Boolean(status?.ollama?.configured);
  const flowiseOn = Boolean(status?.flowise?.configured);

  return (
    <>
      <h3>Open source studio (Ollama + Flowise)</h3>
      <p className="page-lead">
        Operator prompt window. This is not LINE and not Cursor. Requests stay on this host and only call URLs from VPS env
        (<code>OLLAMA_BASE_URL</code>, <code>FLOWISE_BASE_URL</code>). LINE commands still go through <code>resolveCommandReply</code>.
      </p>
      <div className="status-grid">
        <div className={`status-cell ${ollamaOn ? 'on' : 'off'}`}>
          <span className="status-dot" aria-hidden="true" />
          <span className="status-label">Ollama</span>
          <span className="status-value">{ollamaOn ? (status?.ollama?.model || 'ready') : 'unset'}</span>
        </div>
        <div className={`status-cell ${flowiseOn ? 'on' : 'off'}`}>
          <span className="status-dot" aria-hidden="true" />
          <span className="status-label">Flowise</span>
          <span className="status-value">{flowiseOn ? 'ready' : 'unset'}</span>
        </div>
      </div>
      <form className="studio-io" onSubmit={e => void send(e)}>
        <label>
          Engine
          <select value={engine} onChange={e => setEngine(e.target.value as 'ollama' | 'flowise')}>
            <option value="ollama">Ollama</option>
            <option value="flowise">Flowise</option>
          </select>
        </label>
        <label>
          Input
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={5}
            placeholder="Ask the local model. Do not paste secrets."
          />
        </label>
        <button type="submit" disabled={busy || !(engine === 'ollama' ? ollamaOn : flowiseOn)}>Send</button>
        <label>
          Output
          <pre className="studio-out"><code>{output || 'Response appears here.'}</code></pre>
        </label>
      </form>
    </>
  );
};
