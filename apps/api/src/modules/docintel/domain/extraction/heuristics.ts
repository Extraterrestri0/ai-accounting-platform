import type { ExtractedField, FieldKey } from './models';

/**
 * Layer 4 — heuristic accounting extraction. Runs AFTER provider/text/regex layers and
 * only fills keys still MISSING, deriving them from values that are already present and
 * mathematically/logically recoverable. Deterministic and conservative: every derived
 * field is marked source:'derived' with a modest confidence and an explicit reason, so
 * review can see it was inferred. It never overwrites a value another layer found, and
 * it never asserts a checkable fact it cannot derive (e.g. it will NOT invent a VAT
 * number from an EIK, since that would assert VAT registration — Invariant 6).
 */
export interface DerivedNote { key: FieldKey; reason: string; }

const num = (f?: ExtractedField): number | null => {
  if (!f) return null;
  const v = f.valueNormalized ?? f.valueText ?? '';
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const money = (n: number): string => n.toFixed(2);

export function applyHeuristics(fields: ExtractedField[]): { fields: ExtractedField[]; notes: DerivedNote[] } {
  const byKey = new Map<FieldKey, ExtractedField>(fields.map((f) => [f.key, f]));
  const out = [...fields];
  const notes: DerivedNote[] = [];
  const has = (k: FieldKey): boolean => byKey.has(k) && !!(byKey.get(k)!.valueText);
  const add = (key: FieldKey, valueText: string, confidence: number, reason: string, valueNormalized?: string): void => {
    const fld: ExtractedField = { key, valueText, valueNormalized, confidence, source: 'derived', validationStatus: 'unchecked' };
    out.push(fld); byKey.set(key, fld); notes.push({ key, reason });
  };

  // --- amounts: net + vat = total. Derive the single missing one from the other two. ---
  const net = num(byKey.get('net_amount'));
  const vat = num(byKey.get('vat_amount'));
  const total = num(byKey.get('total_amount'));
  if (net != null && vat != null && total == null) add('total_amount', money(net + vat), 0.6, 'derived: net + VAT');
  else if (net != null && total != null && vat == null) add('vat_amount', money(total - net), 0.6, 'derived: total − net');
  else if (vat != null && total != null && net == null) add('net_amount', money(total - vat), 0.6, 'derived: total − VAT');

  // --- vat_rate from VAT / net (snap to a standard BG rate when within 0.6pp) ---
  if (!has('vat_rate')) {
    const n = num(byKey.get('net_amount'));
    const t = num(byKey.get('vat_amount'));
    if (n != null && n > 0 && t != null) {
      const raw = (t / n) * 100;
      const snapped = [20, 9, 0].find((r) => Math.abs(raw - r) <= 0.6);
      const rate = snapped != null ? String(snapped) : (Math.round(raw * 10) / 10).toString();
      add('vat_rate', rate, snapped != null ? 0.7 : 0.55, `derived: VAT/net = ${rate}%`);
    }
  }

  // --- supplier_eik from a Bulgarian VAT number (BG + EIK digits). Safe direction. ---
  if (!has('supplier_eik') && has('supplier_vat')) {
    const v = byKey.get('supplier_vat')!.valueText!;
    const mm = v.match(/^BG(\d{9,10})$/i);
    if (mm) add('supplier_eik', mm[1], 0.7, 'derived: digits of the BG VAT number');
  }

  // --- document_number ↔ invoice_number cross-fill (they are usually the same id) ---
  if (!has('document_number') && has('invoice_number')) add('document_number', byKey.get('invoice_number')!.valueText!, 0.7, 'derived: same as invoice number');
  else if (!has('invoice_number') && has('document_number')) add('invoice_number', byKey.get('document_number')!.valueText!, 0.7, 'derived: same as document number');

  return { fields: out, notes };
}
