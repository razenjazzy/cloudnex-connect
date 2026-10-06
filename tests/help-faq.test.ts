import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const help = readFileSync('admin/src/HelpFaq.tsx', 'utf8');
const ui = readFileSync('admin/src/ui.tsx', 'utf8');
const css = readFileSync('admin/src/app.css', 'utf8');
const demonstration = readFileSync('documents/DEMONSTRATION.md', 'utf8');
const environments = readFileSync('documents/ENVIRONMENTS.md', 'utf8');

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
    expect(help).toContain('Local (R&amp;D)');
    expect(help).toContain('Staging (showcase)');
    expect(help).toContain('Production (cutover hold)');
  });

  it('keeps numbered steps behind FaqRunbook', () => {
    expect(ui).toContain('export const FaqRunbook');
    expect(ui).toContain('{warn ? <p className="warn">{warn}</p> : null}');
    expect(ui).toContain('export const BindFaq');
    expect(ui).toContain('Actor unbound. Bind a super-admin LINE id');
  });

  it('hides Home actor warn and CRM bind steps until FAQ is opened', () => {
    const app = readFileSync('admin/src/App.tsx', 'utf8');
    const demo = readFileSync('admin/src/DemoPanel.tsx', 'utf8');
    expect(app).toContain('<BindFaq');
    expect(app).not.toMatch(/<p className="warn">Actor unbound/);
    expect(app).not.toMatch(/CRM quotes[\s\S]{0,400}<BindSteps/);
    expect(app).not.toMatch(/defaultOpen/);
    expect(demo).toContain('<FaqItem key={mod.id || mod.name}');
    expect(demo).not.toContain('module-grid');
  });

  it('keeps remaining Admin pages on closed FaqRunbook and even action rows', () => {
    const app = readFileSync('admin/src/App.tsx', 'utf8');
    const live = readFileSync('admin/src/LiveServices.tsx', 'utf8');
    const work = readFileSync('admin/src/CommandWork.tsx', 'utf8');
    const studio = readFileSync('admin/src/StudioPanel.tsx', 'utf8');
    const tenants = readFileSync('admin/src/TenantPanel.tsx', 'utf8');
    expect(app).toContain('How grant works');
    expect(app).toContain('How translations work');
    expect(app).toContain('How labels work');
    expect(live).toContain('How this page works');
    expect(live).not.toContain('className="row"');
    expect(work).toContain('className="actions"');
    expect(studio).toContain('How studio works');
    expect(tenants).not.toMatch(/<p className="warn">/);
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).not.toContain('1200px');
  });

  it('states local R&D, staging showcase, production hold until cutover', () => {
    expect(demonstration).toContain('Development, mock LINE (`/webhook-test`), stubs, experimental flags, R&D');
    expect(demonstration).toContain('Showcase of the full product');
    expect(demonstration).toContain('Cut over LINE/Odoo URLs when the client is ready');
    expect(environments).toContain('Demo to client, current running clients, event showcase');
    expect(environments).toContain('Same product as staging until the client is ready to cut over');
  });
});
