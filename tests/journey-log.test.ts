import { describe, expect, it } from 'vitest';
import { journeyCommand } from '../src/line/process-message';

describe('journey log command key', () => {
  it('keeps only the canonical command prefix, never arguments or free text', () => {
    expect(journeyCommand('QUOTE CREATE id:3,4,Acme Co,+8801787671962')).toBe('QUOTE CREATE');
    expect(journeyCommand('verify start +8801787671962')).toBe('VERIFY');
    expect(journeyCommand('NAV HOME')).toBe('NAV HOME');
    expect(journeyCommand('Hello my name is Razen, call +8801787671962')).toBe('free_text');
  });
});
