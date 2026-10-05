/**
 * Phone matching for VERIFY and LINE delivery. Thai 08… / 66… / +66… and
 * Bangladesh 01… / 880… / +880… (11-digit national) stay in separate buckets.
 * Firestore `in` queries allow at most 10 values.
 */
export const phoneMatchVariants = (phone: string): string[] => {
  const cleaned = phone.replace(/[^0-9+]/g, '').trim();
  if (!cleaned) return [];

  const variants = new Set<string>([cleaned]);
  const digits = cleaned.replace(/\D/g, '');

  const addThai = (nationalWithoutZero: string) => {
    if (!nationalWithoutZero) return;
    variants.add(`0${nationalWithoutZero}`);
    variants.add(`+66${nationalWithoutZero}`);
    variants.add(`66${nationalWithoutZero}`);
    variants.add(nationalWithoutZero);
  };

  const addBd = (nationalWithoutZero: string) => {
    if (!nationalWithoutZero) return;
    variants.add(`0${nationalWithoutZero}`);
    variants.add(`+880${nationalWithoutZero}`);
    variants.add(`880${nationalWithoutZero}`);
    variants.add(nationalWithoutZero);
  };

  // BD national 01XXXXXXXXX (11 digits) must not collapse to Thai +66.
  const isBd =
    cleaned.startsWith('+880')
    || (digits.startsWith('880') && digits.length >= 12)
    || (digits.startsWith('01') && digits.length === 11);

  if (isBd) {
    if (digits.startsWith('880')) addBd(digits.slice(3));
    else addBd(digits.slice(1));
  } else {
    if (cleaned.startsWith('0') && cleaned.length >= 9) {
      addThai(cleaned.slice(1));
    } else if (cleaned.startsWith('+66')) {
      addThai(cleaned.slice(3));
    } else if (cleaned.startsWith('66') && digits.length >= 10) {
      addThai(digits.slice(2));
    } else if (/^[1-9]\d{7,9}$/.test(digits) && !digits.startsWith('66')) {
      addThai(digits);
    }
    if (digits.length >= 9) {
      addThai(digits.slice(-9));
    }
  }

  return Array.from(variants).slice(0, 10);
};
