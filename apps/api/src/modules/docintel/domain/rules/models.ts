/** Rules-engine domain models. Suggestions are PROPOSALS — never journal entries (Invariant 4/5). */
export type RuleType = 'supplier_account' | 'supplier_vat' | 'keyword_account' | 'default_account';
export type SuggestionStatus = 'suggested' | 'accepted' | 'rejected' | 'superseded';
export type VatTreatment = 'standard' | 'reduced' | 'zero' | 'exempt' | 'reverse_charge' | 'intra_community' | 'export' | 'import' | 'none';

export interface CounterpartyRef { id: string; name: string; eik?: string; vatNumber?: string; countryCode: string; }
export interface SupplierMatch { counterparty: CounterpartyRef | null; confidence: number; basis: 'eik' | 'vat' | 'name' | 'none'; }
export interface AccountSuggestion { accountCode: string; confidence: number; explanation: string; }
export interface VatSuggestion { treatment: VatTreatment; rate: number; codeId: string | null; confidence: number; explanation: string; }
export interface PostingLine { accountCode: string; side: 'debit' | 'credit'; amount: string; }

export interface ActiveRule { ruleType: RuleType; matchKey?: string; isActive: boolean; name: string; action: { accountCode?: string; vatCode?: string; confidence?: number }; }
export interface AccountingSuggestion {
  id: string; documentId: string; counterpartyId?: string; suggestedAccountCode?: string;
  suggestedPosting: PostingLine[]; confidence: number; explanation: string;
  status: SuggestionStatus; isDuplicate: boolean; duplicateOfDocumentId?: string;
  vat?: { treatment: VatTreatment; rate: number; vatCodeId?: string; confidence: number; explanation: string };
}
