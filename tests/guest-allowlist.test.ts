import { describe, expect, it } from 'vitest';
import { isGuestAllowedCommand } from '../src/line/guest-commands';

describe('isGuestAllowedCommand', () => {
  it('lets a Customer OA guest browse catalog and commerce nav', () => {
    expect(isGuestAllowedCommand('NAV COMMERCE')).toBe(true);
    expect(isGuestAllowedCommand('NAV CATALOG')).toBe(true);
    expect(isGuestAllowedCommand('FORM PRODUCT FIND')).toBe(true);
    expect(isGuestAllowedCommand('PRODUCT FIND App')).toBe(true);
    expect(isGuestAllowedCommand('SERVICE LIST')).toBe(true);
    expect(isGuestAllowedCommand('SERVICE READ SVC-PREMIUM')).toBe(true);
    expect(isGuestAllowedCommand('FORM QUOTE CREATE FROM CARD 11')).toBe(true);
    expect(isGuestAllowedCommand('FORM MESSAGE REQUEST 11')).toBe(true);
    expect(isGuestAllowedCommand('2 UNITS APP PREMIUM')).toBe(true);
    expect(isGuestAllowedCommand('FORM CUSTOMER REGISTER')).toBe(true);
    expect(isGuestAllowedCommand('NAV HOME')).toBe(true);
    expect(isGuestAllowedCommand('FORM ORDER STATUS')).toBe(true);
    expect(isGuestAllowedCommand('FORM VERIFY')).toBe(true);
    expect(isGuestAllowedCommand('NAV DIRECTORY')).toBe(false);
    expect(isGuestAllowedCommand('FORM PRODUCT FIND', { flow: 'PRODUCT_FIND' })).toBe(true);
  });

  it('still requires VERIFY for quote and order commands', () => {
    expect(isGuestAllowedCommand('FORM QUOTE CREATE')).toBe(false);
    expect(isGuestAllowedCommand('FORM QUOTE CREATE FROM CARD 11')).toBe(true);
    expect(isGuestAllowedCommand('QUOTE CREATE App,1')).toBe(false);
    expect(isGuestAllowedCommand('QUOTE LIST')).toBe(false);
    expect(isGuestAllowedCommand('ORDER STATUS SO0001')).toBe(false);
    expect(isGuestAllowedCommand('FORM ORDER STATUS')).toBe(true);
  });
});
