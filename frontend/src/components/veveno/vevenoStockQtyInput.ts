/** Digits only. Leading zeros collapse so typing from 0 becomes 12, not 012. */
export function sanitizeStockQtyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') {
    return '';
  }
  return String(Number.parseInt(digits, 10));
}

export function parseStockQtyInput(raw: string): number {
  if (raw === '') {
    return 0;
  }
  return Number.parseInt(raw, 10);
}
