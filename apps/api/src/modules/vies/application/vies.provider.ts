/** Result returned by a VIES provider (live VIES service or a dev fallback). */
export interface ViesProviderResult {
  valid: boolean;
  name?: string;
  address?: string;
  source: 'live' | 'vendor' | 'format';
  raw?: unknown;
}

/** PORT: a VAT-number existence checker. The live implementation calls the EU VIES
 *  service (or an EU proxy); the dev fallback validates format deterministically. */
export interface ViesProvider {
  check(input: { normalized: string; countryCode: string }): Promise<ViesProviderResult>;
}

export const VIES_PROVIDER = Symbol('Vies.Provider');
