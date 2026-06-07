import type { SaftGlLine, SaftHeader } from './models';

export const SOFTWARE_NAME = 'Счетоводство (MGI-Delta)';
export const SOFTWARE_VERSION = '1.0.0-saft1';

const toCents = (s: string | number): number => Math.round(Number(s) * 100);
const fromCents = (c: number): string => (c / 100).toFixed(2);
const pad2 = (n: number): string => String(n).padStart(2, '0');

const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** First/last calendar day of a month as ISO dates (pure, UTC-safe). */
export function monthBounds(year: number, month: number): { from: string; to: string } {
  const days = [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return { from: `${year}-${pad2(month)}-01`, to: `${year}-${pad2(month)}-${pad2(days)}` };
}

/** A journal entry balances when total debit equals total credit (to the cent). */
export function entryBalanced(lines: SaftGlLine[]): boolean {
  let d = 0; let c = 0;
  for (const l of lines) { d += toCents(l.debit); c += toCents(l.credit); }
  return d === c;
}

/**
 * Derive net/VAT/gross of a purchase from its posted journal lines:
 *   gross = credit on the payable account, VAT = debit on the input-VAT account,
 *   net = gross − VAT. Account codes come from the configurable mapping (not hardcoded).
 */
export function purchaseAmounts(lines: SaftGlLine[], payableCode: string, vatInputCode: string): { net: string; vat: string; gross: string } {
  let grossC = 0; let vatC = 0;
  for (const l of lines) {
    if (l.accountCode === payableCode) grossC += toCents(l.credit);
    if (l.accountCode === vatInputCode) vatC += toCents(l.debit);
  }
  return { net: fromCents(grossC - vatC), vat: fromCents(vatC), gross: fromCents(grossC) };
}

export function buildHeader(input: { companyName: string; eik?: string; vatNumber?: string; currency: string; year: number; month: number; generatedAt: string }): SaftHeader {
  const { from, to } = monthBounds(input.year, input.month);
  return {
    companyName: input.companyName, eik: input.eik, vatNumber: input.vatNumber,
    period: { year: input.year, month: input.month, from, to },
    currency: input.currency, softwareName: SOFTWARE_NAME, softwareVersion: SOFTWARE_VERSION,
    generatedAt: input.generatedAt,
  };
}
