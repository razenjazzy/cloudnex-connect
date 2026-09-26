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
