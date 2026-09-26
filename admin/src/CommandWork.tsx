import { useEffect, useState } from 'react';
import { CopyField } from './ui';
import { t, type UiLang } from './i18n';

type FormSpec = {
  key: string;
  startCommand: string;
  labelEn: string;
  labelTh: string;
  requiresAdmin: boolean;
  fields: Array<{ key: string; promptEn: string; promptTh: string; optional?: boolean }>;
};

type Props = {
  adminBase: string;
  api: (path: string, init?: RequestInit) => Promise<Response>;
  actor: string | null;
  uiLang: UiLang;
  toast: (text: string, kind?: 'ok' | 'error') => void;
};

export const CommandWork = ({ adminBase, api, actor, uiLang, toast }: Props) => {
  const [forms, setForms] = useState<FormSpec[]>([]);
  const [picked, setPicked] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [commandText, setCommandText] = useState('NAV HOME');
  const [out, setOut] = useState('');

  useEffect(() => {
    void (async () => {
      const res = await api(`${adminBase}/api/forms`);
      if (!res.ok) return;
      const body = await res.json() as { forms?: FormSpec[] };
      setForms(body.forms || []);
    })();
  }, [adminBase, api]);

  const spec = forms.find(item => item.startCommand === picked);

  const run = async (preview: boolean) => {
    if (!actor) {
      toast(t(uiLang, 'toastForbidden'));
      return;
    }
    const res = await api(`${adminBase}/api/command`, {
      method: 'POST',
      body: JSON.stringify({ text: commandText, preview }),
    });
    const body = await res.json() as { error?: string; transcript?: Array<{ text?: string }>; form?: FormSpec };
    if (!res.ok) {
      toast(body.error || t(uiLang, 'toastUnauthorized'), 'error');
      return;
    }
    setOut(JSON.stringify(body, null, 2));
    toast(preview ? t(uiLang, 'preview') : t(uiLang, 'confirm'), 'ok');
  };

  return (
    <div className="card">
      <h2>{t(uiLang, 'navWork')}</h2>
      <p className="page-lead">{t(uiLang, 'commandWorkLead')}</p>
      {!actor ? <p className="warn">{t(uiLang, 'bindFirst')}</p> : null}
      <div className="row">
        <select value={picked} onChange={e => {
          const next = e.target.value;
          setPicked(next);
          setValues({});
          setCommandText(next || 'NAV HOME');
        }}>
          <option value="">{t(uiLang, 'pickForm')}</option>
          {forms.map(form => (
            <option key={form.key} value={form.startCommand}>
              {uiLang === 'th' ? form.labelTh : form.labelEn} — {form.startCommand}
            </option>
          ))}
        </select>
      </div>
      {spec ? spec.fields.map(field => (
        <div className="field" key={field.key}>
          <label>{uiLang === 'th' ? field.promptTh : field.promptEn}{field.optional ? ` (${t(uiLang, 'optional')})` : ''}</label>
          <input value={values[field.key] || ''} onChange={e => {
            const next = { ...values, [field.key]: e.target.value };
            setValues(next);
            const parts = spec.fields.map(item => next[item.key] || '').filter(Boolean);
            setCommandText(parts.length ? `${spec.startCommand.replace(/^FORM /, '')} ${parts.join(',')}` : spec.startCommand);
          }} />
        </div>
      )) : null}
      <div className="field">
        <label>{t(uiLang, 'commandText')}</label>
        <input value={commandText} onChange={e => setCommandText(e.target.value)} />
      </div>
      <div className="row">
        <button type="button" disabled={!actor} onClick={() => void run(true)}>{t(uiLang, 'preview')}</button>
        <button type="button" disabled={!actor} onClick={() => void run(false)}>{t(uiLang, 'confirm')}</button>
      </div>
      {out ? <CopyField label={t(uiLang, 'commandResult')} value={out} /> : null}
    </div>
  );
};
