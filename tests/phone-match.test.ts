import { describe, expect, it } from 'vitest';
import { phoneMatchVariants } from '../src/services/phone-match';

describe('phoneMatchVariants', () => {
  it('matches a local number with and without country code', () => {
    const fromLocal = phoneMatchVariants('0812345678');
    expect(fromLocal).toEqual(expect.arrayContaining(['0812345678', '+66812345678', '66812345678', '812345678']));
    const fromShort = phoneMatchVariants('812345678');
    expect(fromShort).toEqual(expect.arrayContaining(['0812345678', '+66812345678', '812345678']));
    const fromIntl = phoneMatchVariants('+66812345678');
    expect(fromIntl).toEqual(expect.arrayContaining(['0812345678', '+66812345678']));
  });

  it('maps Razen 01… numbers to +880, not Thai +66', () => {
    expect(phoneMatchVariants('+8801787671962')).toEqual(expect.arrayContaining([
      '+8801787671962',
      '01787671962',
      '8801787671962',
    ]));
    expect(phoneMatchVariants('01787671962')).toEqual(expect.arrayContaining(['+8801787671962', '01787671962']));
    expect(phoneMatchVariants('01787671962').join(',')).not.toContain('+66');
  });

  it('stays within Firestore in-query limit', () => {
    expect(phoneMatchVariants('+66812345678').length).toBeLessThanOrEqual(10);
  });
});
