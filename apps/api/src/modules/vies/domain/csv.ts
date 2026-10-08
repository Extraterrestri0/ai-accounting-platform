import type { ViesDatasetRow } from './models';

/** RFC-4180-ish CSV field escaping (quote when the value contains , " ; or newline). */
function esc(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Pure CSV serializer for the VIES dataset (Bulgarian headers). CRLF line endings.
 * A UTF-8 BOM is added at the API edge (not here) so this stays trivially testable.
 */
export function toViesCsv(rows: ViesDatasetRow[]): string {
  const header = ['Клиент', 'ДДС номер', 'Държава', 'Фактура', 'Дата', 'Данъчна основа', 'Валута'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([r.counterpartyName, r.vatNumber, r.countryCode, r.invoiceNumber, r.invoiceDate, r.taxableAmount, r.currency].map(esc).join(','));
  }
  return lines.join('\r\n');
}
