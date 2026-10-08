import type { PostedEntry, RegisterRow, ValidationIssue, VatReturnDataset, VatSummary, VatTreatment } from './models';

export const VAT_INPUT_ACCOUNT = '4531';   // deductible input VAT (purchases)
export const VAT_OUTPUT_ACCOUNT = '4532';  // output VAT (sales)
const RECEIVABLE_PAYABLE = ['401', '411'];
const round2 = (n: number): number => Math.round(n * 100) / 100;
/**
 * SIGNED sum: amounts posted on the `positive` side add, the opposite side subtracts.
 * This makes the register sign-aware:
 *   - a normal sales invoice posts output VAT on CREDIT      → positive (adds to sales)
 *   - a CREDIT NOTE posts revenue + output VAT on DEBIT      → negative (reduces sales)
 *   - a DEBIT NOTE posts like an invoice (credit/debit normal)→ positive (increases sales)
 *   - a purchase posts input VAT on DEBIT                    → positive (adds to purchases)
 * Proformas never post to the ledger, so they never reach this classifier.
 */
const signed = (lines: { direction: 'debit' | 'credit'; amount: string }[], positive: 'debit' | 'credit'): number =>
  lines.reduce((s, l) => s + (l.direction === positive ? Number(l.amount) : -Number(l.amount)), 0);

/** Classify a posted entry into a (signed) register row, computing base/VAT/deductible from its lines. */
export function classifyEntry(entry: PostedEntry): Omit<RegisterRow, 'treatment' | 'rate' | 'vatCodeId'> {
  const inLines = entry.lines.filter((l) => l.code === VAT_INPUT_ACCOUNT);
  const outLines = entry.lines.filter((l) => l.code === VAT_OUTPUT_ACCOUNT);
  const looksPurchase = inLines.length > 0
    || (outLines.length === 0 && entry.lines.some((l) => l.direction === 'debit' && !RECEIVABLE_PAYABLE.includes(l.code) && l.code !== VAT_INPUT_ACCOUNT));
  if (looksPurchase) {
    // purchase: input VAT positive on debit; expense base positive on debit (negative on a supplier credit note)
    const vat = signed(inLines, 'debit');
    const base = signed(entry.lines.filter((l) => l.code !== VAT_INPUT_ACCOUNT && !RECEIVABLE_PAYABLE.includes(l.code)), 'debit');
    return { journalEntryId: entry.journalEntryId, kind: 'purchase', base: round2(base), vat: round2(vat), deductible: round2(vat), documentRef: entry.sourceRef };
  }
  // sales: output VAT positive on credit; revenue base positive on credit (negative on a credit note)
  const vat = signed(outLines, 'credit');
  const base = signed(entry.lines.filter((l) => l.code !== VAT_OUTPUT_ACCOUNT && !RECEIVABLE_PAYABLE.includes(l.code)), 'credit');
  return { journalEntryId: entry.journalEntryId, kind: 'sales', base: round2(base), vat: round2(vat), deductible: 0, documentRef: entry.sourceRef };
}

export function treatmentFromRate(base: number, vat: number): { rate: number; treatment: VatTreatment } {
  // rate is computed from magnitudes so a credit note (negative base/VAT) still maps to 20% standard.
  const b = Math.abs(base); const v = Math.abs(vat);
  if (b <= 0) return { rate: 0, treatment: v > 0 ? 'standard' : 'none' };
  const rate = Math.round((v / b) * 100);
  const treatment: VatTreatment = rate >= 20 ? 'standard' : rate >= 9 ? 'reduced' : rate > 0 ? 'reduced' : 'zero';
  return { rate, treatment };
}

export function summarize(rows: RegisterRow[]): VatSummary {
  const output = rows.filter((r) => r.kind === 'sales').reduce((s, r) => s + r.vat, 0);
  const deductible = rows.filter((r) => r.kind === 'purchase').reduce((s, r) => s + r.deductible, 0);
  return { outputVat: round2(output), deductibleVat: round2(deductible), vatPayable: round2(Math.max(0, output - deductible)), vatRefundable: round2(Math.max(0, deductible - output)) };
}

export function buildReturnDataset(rows: RegisterRow[], s: VatSummary): VatReturnDataset {
  const salesBase = rows.filter((r) => r.kind === 'sales').reduce((a, r) => a + r.base, 0);
  const purchaseBase = rows.filter((r) => r.kind === 'purchase').reduce((a, r) => a + r.base, 0);
  return {
    cell11_taxableBaseSales: round2(salesBase).toFixed(2), cell50_outputVat: s.outputVat.toFixed(2),
    cell30_taxableBasePurchases: round2(purchaseBase).toFixed(2), cell60_deductibleVat: s.deductibleVat.toFixed(2),
    cell40_vatPayable: s.vatPayable.toFixed(2), cell80_vatRefundable: s.vatRefundable.toFixed(2),
  };
}

const ALLOWED: VatTreatment[] = ['standard', 'reduced', 'zero', 'exempt', 'reverse_charge', 'intra_community', 'export', 'import', 'none'];
export function validate(rows: RegisterRow[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []; const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.journalEntryId}|${r.kind}`;
    if (seen.has(key)) issues.push({ code: 'duplicate', journalEntryId: r.journalEntryId });
    seen.add(key);
    if ((r.treatment === 'standard' || r.treatment === 'reduced') && !r.vatCodeId) issues.push({ code: 'missing_vat_code', journalEntryId: r.journalEntryId });
    if (!ALLOWED.includes(r.treatment)) issues.push({ code: 'invalid_treatment', journalEntryId: r.journalEntryId, detail: r.treatment });
  }
  return issues;
}
