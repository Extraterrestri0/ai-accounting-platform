import type { SaftGlLine, SaftHeader } from './models';

/** Raw ledger line row (one DB row), before grouping into entries. */
export interface RawGlLineRow { entryId: string; lineNumber: number; accountCode: string; direction: string; amount: string; narrative?: string; }

/**
 * Group a flat, batched set of ledger-line rows by their entry id (pure). Lets the
 * repository fetch ALL lines for a period in one query and assemble them in memory,
 * instead of one query per entry (N+1).
 */
export function groupLinesByEntry(rows: RawGlLineRow[]): Map<string, SaftGlLine[]> {
  const byEntry = new Map<string, SaftGlLine[]>();
  for (const r of rows) {
    const line: SaftGlLine = {
      lineNumber: r.lineNumber, accountCode: r.accountCode,
      debit: r.direction === 'debit' ? r.amount : '0.00',
      credit: r.direction === 'credit' ? r.amount : '0.00',
      narrative: r.narrative,
    };
    const arr = byEntry.get(r.entryId);
    if (arr) arr.push(line); else byEntry.set(r.entryId, [line]);
  }
  return byEntry;
}

export const SOFTWARE_NAME = 'Счетоводство (MGI-Delta)';
export const SOFTWARE_VERSION = '1.0.0-saft1';

// ---- exact-decimal money (Phase 8 #3) ----
// Amounts are exact 2dp decimals at rest (numeric(20,2)). Parse to integer MINOR UNITS by
// string-splitting on the decimal point — NEVER `Number(s) * 100` (which introduces float error,
// e.g. 0.1*100 = 10.000000000000002). Returns null for non-numeric input (caller decides fallback).
export function parseMoneyOrNull(s: string | number | null | undefined): number | null {
  if (s === null || s === undefined) return null;
  const str = (typeof s === 'number' ? s.toFixed(2) : String(s)).trim();
  if (!/^-?\d+(\.\d+)?$/.test(str)) return null;
  const neg = str.startsWith('-');
  const [intPart, fracRaw = ''] = (neg ? str.slice(1) : str).split('.');
  const frac = (fracRaw + '00').slice(0, 2);
  const cents = Number(intPart) * 100 + Number(frac); // both operands are exact non-negative integers
  return neg ? -cents : cents;
}
/** Parse to minor units, treating unparseable/absent input as 0. */
export function moneyToCents(s: string | number | null | undefined): number {
  return parseMoneyOrNull(s) ?? 0;
}
/** Format integer minor units back to a 2dp decimal string. */
export function centsToString(c: number): string {
  const neg = c < 0; const a = Math.abs(Math.trunc(c));
  const out = `${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
  return neg ? `-${out}` : out;
}
const pad2 = (n: number): string => String(n).padStart(2, '0');

const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** First/last calendar day of a month as ISO dates (pure, UTC-safe). */
export function monthBounds(year: number, month: number): { from: string; to: string } {
  const days = [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return { from: `${year}-${pad2(month)}-01`, to: `${year}-${pad2(month)}-${pad2(days)}` };
}

/** A journal entry balances when total debit equals total credit (exact, to the minor unit). */
export function entryBalanced(lines: SaftGlLine[]): boolean {
  let d = 0; let c = 0;
  for (const l of lines) { d += moneyToCents(l.debit); c += moneyToCents(l.credit); }
  return d === c;
}

/** Source-document amounts (e.g. from the approved extraction), any may be absent. */
export interface PurchaseDocAmounts { net?: string | null; vat?: string | null; gross?: string | null; }

/**
 * Derive net/VAT/gross of a purchase (Phase 8 #4 Option A) WITHOUT the current posting-account
 * mapping (no effective-dating dependency, period-stable):
 *   - gross is ALWAYS taken from the posted ledger lines as the sum of credits (the funding side),
 *     which holds whether the purchase is settled via a payable or directly in cash.
 *   - when the approved source document provides a net/VAT/gross split that reconciles to the
 *     ledger gross, that split is used; otherwise net = gross − VAT (document VAT, clamped) or
 *     net = gross when no document VAT is available (a data gap surfaced by validation).
 */
export function derivePurchaseAmounts(lines: SaftGlLine[], doc?: PurchaseDocAmounts): { net: string; vat: string; gross: string } {
  let grossC = 0;
  for (const l of lines) grossC += moneyToCents(l.credit);
  const docGross = parseMoneyOrNull(doc?.gross);
  const docVat = parseMoneyOrNull(doc?.vat);
  const docNet = parseMoneyOrNull(doc?.net);
  if (docGross !== null && docGross === grossC && docVat !== null && docNet !== null && docNet + docVat === docGross) {
    return { net: centsToString(docNet), vat: centsToString(docVat), gross: centsToString(docGross) };
  }
  const vatC = docVat !== null && docVat >= 0 && docVat <= grossC ? docVat : 0;
  return { net: centsToString(grossC - vatC), vat: centsToString(vatC), gross: centsToString(grossC) };
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
