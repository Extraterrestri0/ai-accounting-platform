/** Where a validation verdict came from. */
export type ViesSource = 'cache' | 'live' | 'vendor' | 'format';

/** Normalized result of validating one EU VAT number. */
export interface ViesValidationResult {
  vatNumber: string;        // normalized (upper-case, no spaces, incl. country prefix)
  countryCode: string;      // ISO alpha-2 (EL→GR)
  valid: boolean;
  source: ViesSource;
  fromCache: boolean;
  name?: string;
  address?: string;
  checkedAt: string;
  expiresAt: string;
}

export type ViesStatusKind = 'valid' | 'invalid' | 'unchecked';

/** A counterparty's current VIES status (latest stored check, if any). */
export interface ViesStatus {
  counterpartyId: string;
  vatNumber?: string;
  countryCode?: string;
  status: ViesStatusKind;
  valid?: boolean;
  name?: string;
  checkedAt?: string;
  expiresAt?: string;
  stale: boolean;           // true when there is a check but it has expired
}

/** One row of the VIES (recapitulative) declaration dataset. */
export interface ViesDatasetRow {
  counterpartyId?: string;
  counterpartyName: string;
  vatNumber: string;
  countryCode: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxableAmount: string;    // exact decimal (net of intra-community supply)
  currency: string;
}

export interface ViesDataset {
  year: number;
  month: number;
  rows: ViesDatasetRow[];
  totalTaxable: string;
  count: number;
}
