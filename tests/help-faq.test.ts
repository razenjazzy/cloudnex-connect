import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const help = readFileSync('admin/src/HelpFaq.tsx', 'utf8');
const ui = readFileSync('admin/src/ui.tsx', 'utf8');
const css = readFileSync('admin/src/app.css', 'utf8');

describe('Admin FAQ rows', () => {
  it('keeps Copy off the FAQ toggle row', () => {
    expect(ui).not.toContain('faq-toggle-row');
    expect(css).not.toContain('faq-toggle-row');
    expect(ui).toContain('faq-snippet-toolbar');
    expect(css).toContain('faq-snippet-toolbar');
  });

  it('lists staging and production Admin and .env paths', () => {
    expect(help).toContain('/admin/test');
    expect(help).toContain('/opt/cns-line-oa/.env');
    expect(help).toContain('/opt/cloudnex-connect/.env');
    expect(help).toContain('lane-table');
    expect(help).toContain('Local (experimental)');
  });

  it('keeps numbered steps behind FaqRunbook', () => {
    expect(ui).toContain('export const FaqRunbook');
    expect(ui).toContain('{warn ? <p className="warn">{warn}</p> : null}');
  });
});
