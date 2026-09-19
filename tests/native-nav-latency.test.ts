import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('native tray reply path', () => {
  it('does not await LINE rich-menu link before the webhook reply', () => {
    const router = readFileSync('src/line/command-router.ts', 'utf8');
    expect(router).not.toContain('await linkUserRichMenu');
    expect(router).toContain('trayHighlight');
    const processMessage = readFileSync('src/line/process-message.ts', 'utf8');
    expect(processMessage).toContain('pendingCatalogPush');
    expect(processMessage).toContain('pushDeferredCommerceCatalog');
    const deliverIdx = processMessage.indexOf('const delivered = await deliverMessages');
    const linkIdx = processMessage.indexOf('void linkUserRichMenu');
    expect(deliverIdx).toBeGreaterThan(-1);
    expect(linkIdx).toBeGreaterThan(deliverIdx);
  });
});
