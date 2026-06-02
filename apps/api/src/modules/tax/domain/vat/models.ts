/** VAT domain models (Bulgarian VAT). Reads the immutable ledger; writes only VAT tables. */
export type RegisterKind = 'purchase' | 'sales';
export type VatTreatment = 'standard' | 'reduced' | 'zero' | 'exempt' | 'reverse_charge' | 'intra_community' | 'export' | 'import' | 'none';

export interface PostedLine { code: string; direction: 'debit' | 'credit'; amount: string; }
export interface PostedEntry { journalEntryId: string; entryNo: number; postingDate: string; sourceRef?: string; lines: PostedLine[]; }

export interface RegisterRow {
  journalEntryId: string; kind: RegisterKind; base: number; vat: number; deductible: number;
  treatment: VatTreatment; rate: number; vatCodeId?: string; documentRef?: string;
}
export interface VatSummary { outputVat: number; deductibleVat: number; vatPayable: number; vatRefundable: number; }
export interface VatReturnDataset {
  cell11_taxableBaseSales: string; cell50_outputVat: string;
  cell30_taxableBasePurchases: string; cell60_deductibleVat: string;
  cell40_vatPayable: string; cell80_vatRefundable: string;
}
export interface VatPeriod { id: string; year: number; month: number; status: 'open' | 'closed' | 'submitted'; startsOn: string; endsOn: string; }
export interface ValidationIssue { code: 'duplicate' | 'missing_vat_code' | 'invalid_treatment'; journalEntryId: string; detail?: string; }
