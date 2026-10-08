import type { NormalizedRow, ParsedRow, RowError, TransactionType } from './models';

/** Canonical field → accepted header aliases (lower-cased, EN + BG). */
const HEADER_ALIASES: Record<string, string[]> = {
  bookingDate: ['date', 'booking_date', 'booking date', 'bookingdate', 'дата', 'дата на осчетоводяване', 'осчетоводяване'],
  valueDate: ['value_date', 'value date', 'valuedate', 'вальор', 'дата вальор'],
  amount: ['amount', 'сума', 'стойност'],
  currency: ['currency', 'валута'],
  description: ['description', 'details', 'описание', 'детайли'],
  counterpartyName: ['counterparty_name', 'counterparty', 'counterpartyname', 'наименование', 'контрагент', 'име на контрагент'],
  counterpartyIban: ['counterparty_iban', 'counterpartyiban', 'iban', 'iban контрагент'],
  reference: ['reference', 'ref', 'основание', 'референция'],
  transactionType: ['transaction_type', 'type', 'transactiontype', 'тип', 'посока'],
};

/** Lower-case + trim a header for matching. */
export const normHeader = (h: string): string => h.replace(/^﻿/, '').trim().toLowerCase();

/** Read a canonical field from a parsed row by trying its aliases. */
function pick(row: ParsedRow, field: keyof typeof HEADER_ALIASES): string | undefined {
  for (const alias of HEADER_ALIASES[field]) {
    const v = row[alias];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return undefined;
}

/** Parse an amount in EU or US notation into a signed 2dp decimal string. */
export function parseAmount(raw: string): string {
  const t = String(raw).trim();
  if (!t) throw new Error('Липсва сума');
  const neg = /^\(.*\)$/.test(t) || /-/.test(t);
  const s = t.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) throw new Error(`Невалидна сума „${raw}“`);
  const lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  let intPart: string, frac: string;
  if (lastSep === -1) { intPart = s; frac = ''; }
  else { intPart = s.slice(0, lastSep).replace(/[.,]/g, ''); frac = s.slice(lastSep + 1).replace(/[.,]/g, ''); }
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(frac)) throw new Error(`Невалидна сума „${raw}“`);
  const value = Number(`${intPart || '0'}.${frac || '0'}`);
  if (!Number.isFinite(value)) throw new Error(`Невалидна сума „${raw}“`);
  return ((neg ? -1 : 1) * value).toFixed(2);
}

/** Parse a date (ISO, DD.MM.YYYY, DD/MM/YYYY, or an Excel serial) → YYYY-MM-DD. */
export function parseDate(raw: string): string {
  const t = String(raw).trim();
  if (!t) throw new Error('Липсва дата');
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{4,6}$/.test(t)) { // Excel serial (days since 1899-12-30, UTC-safe)
    const ms = (Number(t) - 25569) * 86400000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  throw new Error(`Невалидна дата „${raw}“`);
}

function pickType(raw: string | undefined, amount: string): TransactionType {
  const v = (raw ?? '').toLowerCase();
  if (['inbound', 'credit', 'cr', 'кредит', 'постъпление', 'in'].includes(v)) return 'inbound';
  if (['outbound', 'debit', 'dr', 'дебит', 'плащане', 'out'].includes(v)) return 'outbound';
  return Number(amount) >= 0 ? 'inbound' : 'outbound';
}

/**
 * Validate + normalize one parsed row. `rowNo` is 1-based for human-readable errors.
 * Returns the normalized row OR a list of field errors (never both).
 */
export function normalizeRow(row: ParsedRow, rowNo: number): { row?: NormalizedRow; errors: RowError[] } {
  const errors: RowError[] = [];
  let bookingDate = '';
  try { bookingDate = parseDate(pick(row, 'bookingDate') ?? ''); }
  catch (e) { errors.push({ row: rowNo, field: 'date', message: (e as Error).message }); }

  let amount = '';
  try {
    amount = parseAmount(pick(row, 'amount') ?? '');
    if (Number(amount) === 0) errors.push({ row: rowNo, field: 'amount', message: 'Нулева сума' });
  } catch (e) { errors.push({ row: rowNo, field: 'amount', message: (e as Error).message }); }

  let valueDate: string | undefined;
  const vRaw = pick(row, 'valueDate');
  if (vRaw) { try { valueDate = parseDate(vRaw); } catch { /* optional → ignore */ } }

  if (errors.length) return { errors };

  return {
    errors: [],
    row: {
      bookingDate, valueDate, amount,
      currency: (pick(row, 'currency') ?? 'EUR').toUpperCase(),
      description: pick(row, 'description'),
      counterpartyName: pick(row, 'counterpartyName'),
      counterpartyIban: pick(row, 'counterpartyIban')?.replace(/\s/g, '').toUpperCase(),
      reference: pick(row, 'reference'),
      transactionType: pickType(pick(row, 'transactionType'), amount),
    },
  };
}

/** Stable canonical key for duplicate detection (hashed by the import service). */
export function dedupKey(r: NormalizedRow): string {
  return [r.bookingDate, r.amount, r.reference ?? '', r.counterpartyIban ?? '', r.counterpartyName ?? '', r.description ?? '']
    .map((x) => String(x).trim().toLowerCase()).join('|');
}
