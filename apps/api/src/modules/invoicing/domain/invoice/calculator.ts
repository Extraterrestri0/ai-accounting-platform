import type { InvoiceLineInput, InvoiceTotals } from './models';

class InvoiceValidationError extends Error {}
const toCents = (s: string): number => {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(s).trim());
  if (!m) throw new InvoiceValidationError(`Invalid amount "${s}".`);
  return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 100 + parseInt((m[3] ?? '').padEnd(2, '0'), 10));
};
const fromCents = (c: number): string => (c / 100).toFixed(2);

/** Per-line net/VAT/gross from quantity × unit price × rate, in exact cents (never float money). */
export function computeLine(line: InvoiceLineInput): { net: string; vat: string; gross: string } {
  const net = Math.round(Number(line.quantity) * toCents(line.unitPrice));
  const vat = Math.round((net * Number(line.vatRate)) / 100);
  return { net: fromCents(net), vat: fromCents(vat), gross: fromCents(net + vat) };
}
export function computeTotals(lines: { netAmount: string; vatAmount: string }[]): InvoiceTotals {
  let net = 0; let vat = 0;
  for (const l of lines) { net += toCents(l.netAmount); vat += toCents(l.vatAmount); }
  return { net: fromCents(net), vat: fromCents(vat), gross: fromCents(net + vat) };
}
export function formatInvoiceNumber(prefix: string, n: number, pad = 4): string {
  return `${prefix}${String(n).padStart(pad, '0')}`;
}

export { InvoiceValidationError };
export function validateForIssue(args: { customerId?: string; customerName?: string; lines: InvoiceLineInput[] }): void {
  if (!args.customerId && !args.customerName) throw new InvoiceValidationError('A customer is required.');
  if (!args.lines?.length) throw new InvoiceValidationError('An invoice needs at least one line.');
  for (const l of args.lines) {
    if (!(Number(l.quantity) > 0)) throw new InvoiceValidationError('Line quantity must be positive.');
    if (toCents(l.unitPrice) < 0) throw new InvoiceValidationError('Line unit price must be >= 0.');
    if (!l.description?.trim()) throw new InvoiceValidationError('Line description is required.');
  }
}
