import { describe, expect, it } from 'vitest';
import { commandPrefixForAudit } from '../src/services/write-audit';

describe('commandPrefixForAudit', () => {
  it('redacts email and Thai mobile numbers from write-approval detail', () => {
    expect(commandPrefixForAudit('QUOTE SEND CONFIRM 51 BOTH user@example.com')).toBe('QUOTE SEND CONFIRM 51 BOTH [email]');
    expect(commandPrefixForAudit('MESSAGE CUSTOMER 0812345678 Hello')).toBe('MESSAGE CUSTOMER [phone] Hello');
  });
});
