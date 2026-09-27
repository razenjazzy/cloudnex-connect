import { MouseEvent, ReactNode, useEffect, useState } from 'react';

const softenUrl = (value: string): string =>
  value.replace(/https:\/\//gi, 'https:\u200b//').replace(/http:\/\//gi, 'http:\u200b//');

const stopInjectedLink = (event: MouseEvent, onToggle: () => void) => {
  const link = (event.target as Element | null)?.closest?.('a');
  if (!link) return;
  event.preventDefault();
  event.stopPropagation();
  onToggle();
};

export const FaqItem = ({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`faq-item${open ? ' open' : ''}`}>
      <button type="button" className="faq-toggle" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <span className="faq-title">{title}</span>
        <span className="faq-chevron" aria-hidden="true">▾</span>
      </button>
      {open ? <div className="faq-body">{children}</div> : null}
    </div>
  );
};

export const CopyField = ({
  label,
  value,
  url,
  src,
  load,
  defaultOpen = false,
}: {
  label: string;
  value: string;
  url?: string;
  src?: string;
  load?: () => Promise<string>;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const [live, setLive] = useState(value);

  useEffect(() => {
    setLive(value);
  }, [value]);

  const fill = () => {
    if (load) {
      void load().then(setLive).catch(() => setLive(value || 'Request failed.'));
      return;
    }
    if (!src) return;
    void (async () => {
      try {
        const res = await fetch(src, { credentials: 'include' });
        const text = await res.text();
        try {
          setLive(JSON.stringify(JSON.parse(text), null, 2));
        } catch {
          setLive(text || `HTTP ${res.status}`);
        }
      } catch {
        setLive(value || 'Request failed.');
      }
    })();
  };

  const toggle = () => {
    setOpen(prev => {
      const next = !prev;
      if (next) fill();
      return next;
    });
  };

  const copyText = url ? `${url}\n\n${live}` : live;

  return (
    <div className={`faq-item snippet-faq${open ? ' open' : ''}`} onClickCapture={e => stopInjectedLink(e, toggle)}>
      <div className="faq-toggle-row">
        <button type="button" className="faq-toggle" aria-expanded={open} onClick={toggle}>
          <span className="faq-title">{label}</span>
          <span className="faq-chevron" aria-hidden="true">▾</span>
        </button>
        {open ? (
          <button
            type="button"
            className="copy"
            onClick={() => {
              void navigator.clipboard.writeText(copyText);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            }}
          >{copied ? 'Copied' : 'Copy'}</button>
        ) : null}
      </div>
      {open ? (
        <div className="faq-body">
          {url ? <p className="snippet-url">{softenUrl(url)}</p> : null}
          <pre><code>{live}</code></pre>
        </div>
      ) : null}
    </div>
  );
};

export const Steps = ({ items }: { items: Array<ReactNode> }) => (
  <ol className="steps">
    {items.map((item, index) => (
      <li key={index} className="step">
        <span className="step-num">Step {index + 1}</span>
        <div className="step-body">{item}</div>
      </li>
    ))}
  </ol>
);

/** Shared actor bind runbook — Home, Identity, Campaigns, Settings, CRM. */
export const BindSteps = ({
  adminBase,
  onIdentity,
}: {
  adminBase: string;
  onIdentity?: () => void;
}) => (
  <Steps items={[
    <>Sign in to Admin with <code>OPS_API_TOKEN</code> (the panel password). That is not the actor cookie.</>,
    <>On the VPS <code>.env</code>, set the same Cloudnex Sales LINE user id on <code>ADMIN_USER_ID</code> and <code>SUPER_ADMIN_USER_IDS</code> (comma-separated if several). Recreate the container so the process reloads env. Do not commit <code>.env</code>.</>,
    <>In LINE, open Cloudnex Sales. Complete VERIFY so the profile is <code>odooVerified</code>.</>,
    <>
      Open{' '}
      <a
        href={`${adminBase}/identity`}
        onClick={e => {
          e.preventDefault();
          onIdentity?.();
        }}
      >Identity → Bind</a>
      . Paste that LINE id (<code>U</code> + 32 hex). Directory lookup can find it after VERIFY.
    </>,
    <>Send code. OTP arrives on Cloudnex Sales. Confirm. The actor cookie is now bound (header pill says bound).</>,
    <>LINE Login is optional (Identity IdP). Campaigns, secret reveal, CRM command run, and privilege grant need the bind. Jobs Run uses OPS sign-in plus <code>ADMIN_SECRET_TOKEN</code> and does not need actor.</>,
  ]} />
);

export type ToastItem = { id: number; kind: 'error' | 'ok'; text: string };

export const ToastStack = ({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) => (
  <div className="toast-stack" role="status" aria-live="polite">
    {items.map(item => (
      <button
        key={item.id}
        type="button"
        className={`toast toast-${item.kind}`}
        onClick={() => onDismiss(item.id)}
      >{item.text}</button>
    ))}
  </div>
);
