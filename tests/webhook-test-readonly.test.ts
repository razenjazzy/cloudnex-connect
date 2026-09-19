import { describe, expect, it } from 'vitest';
import { isReadOnlyWebhookTestCommand } from '../src/http/middleware';

describe('isReadOnlyWebhookTestCommand', () => {
  it('allows tray navigation used for staging probes', () => {
    expect(isReadOnlyWebhookTestCommand('NAV HOME')).toBe(true);
    expect(isReadOnlyWebhookTestCommand('NAV commerce')).toBe(true);
    expect(isReadOnlyWebhookTestCommand('LANG')).toBe(true);
    expect(isReadOnlyWebhookTestCommand('BACK')).toBe(true);
    expect(isReadOnlyWebhookTestCommand('GUIDE')).toBe(true);
    expect(isReadOnlyWebhookTestCommand('PRODUCT FIND')).toBe(true);
  });

  it('rejects mutating or privileged commands', () => {
    expect(isReadOnlyWebhookTestCommand('FORM VERIFY')).toBe(false);
    expect(isReadOnlyWebhookTestCommand('FORM QUOTE CREATE')).toBe(false);
    expect(isReadOnlyWebhookTestCommand('QUOTE SEND 1')).toBe(false);
    expect(isReadOnlyWebhookTestCommand('NAV admin')).toBe(false);
  });
});
