import type { PostedEntry, RegisterRow, ValidationIssue, VatReturnDataset, VatSummary, VatTreatment } from './models';

export const VAT_INPUT_ACCOUNT = '4531';   // deductible input VAT (purchases)
export const VAT_OUTPUT_ACCOUNT = '4532';  // output VAT (sales)
const RECEIVABLE_PAYABLE = ['401', '411'];
const round2 = (n: number): number => Math.round(n * 100) / 100;
const sum = (xs: { amount: string }[]): number => xs.reduce((s, l) => s + Number(l.amount), 0);

/** Classify a posted entry into a register row, computing base/VAT/deductible from its lines. */
export function classifyEntry(entry: PostedEntry): Omit<RegisterRow, 'treatment' | 'rate' | 'vatCodeId'> {
  const vin = sum(entry.lines.filter((l) => l.code === VAT_INPUT_ACCOUNT));
  const vout = sum(entry.lines.filter((l) => l.code === VAT_OUTPUT_ACCOUNT));
  const looksPurchase = vin > 0 || (vout === 0 && entry.lines.some((l) => l.direction === 'debit' && !RECEIVABLE_PAYABLE.includes(l.code) && l.code !== VAT_INPUT_ACCOUNT));
  if (looksPurchase) {
    const base = sum(entry.lines.filter((l) => l.direction === 'debit' && l.code !== VAT_INPUT_ACCOUNT));
    return { journalEntryId: entry.journalEntryId, kind: 'purchase', base: round2(base), vat: round2(vin), deductible: round2(vin), documentRef: entry.sourceRef };
  }
  const base = sum(entry.lines.filter((l) => l.direction === 'credit' && l.code !== VAT_OUTPUT_ACCOUNT));
  return { journalEntryId: entry.journalEntryId, kind: 'sales', base: round2(base), vat: round2(vout), deductible: 0, documentRef: entry.sourceRef };
}

export function treatmentFromRate(base: number, vat: number): { rate: number; treatment: VatTreatment } {
  if (base <= 0) return { rate: 0, treatment: vat > 0 ? 'standard' : 'none' };
  const rate = Math.round((vat / base) * 100);
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
