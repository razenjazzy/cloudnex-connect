import { describe, expect, it } from 'vitest';
import { journeyCommand } from '../src/line/process-message';

describe('journey log command key', () => {
  it('keeps only the canonical command prefix, never arguments or free text', () => {
    expect(journeyCommand('QUOTE CREATE id:3,4,Acme Co,0812345678')).toBe('QUOTE CREATE');
    expect(journeyCommand('verify start 0812345678')).toBe('VERIFY');
    expect(journeyCommand('NAV HOME')).toBe('NAV HOME');
    expect(journeyCommand('Hello my name is Somchai, call 0812345678')).toBe('free_text');
  });
});
