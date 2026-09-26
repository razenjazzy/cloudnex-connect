const DEFAULT_CHIPS = [10, 15, 20, 25, 30, 35, 40, 45, 50];

/** LINE quickReply max is 13. Qty chips share the bar with Cancel (+ Skip / Home). */
export const parseCustomerQtyChips = (raw = process.env.CUSTOMER_QTY_CHIPS): number[] => {
  const parsed = (raw || '')
    .split(',')
    .map(part => Number(part.trim()))
    .filter(n => Number.isInteger(n) && n > 0 && n <= 10000);
  const unique = [...new Set(parsed.length ? parsed : DEFAULT_CHIPS)];
  return unique.slice(0, 11);
};

export const customerQtyChipLabels = (raw?: string): string[] =>
  parseCustomerQtyChips(raw).map(String);
