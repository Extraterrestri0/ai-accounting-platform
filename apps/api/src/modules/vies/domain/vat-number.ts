/** Pure VAT-number helpers for VIES — normalization + country parsing. No IO. */

/** Strip spaces/punctuation, upper-case, and parse the country code (EL→GR). */
export function normalizeVat(raw: string): { normalized: string; countryCode: string } {
  const normalized = (raw ?? '').replace(/[\s.\-/]/g, '').toUpperCase();
  const prefix = normalized.slice(0, 2);
  const countryCode = prefix === 'EL' ? 'GR' : prefix;
  return { normalized, countryCode };
}

/** EU VAT prefixes (incl. EL for Greece) used to decide if a number is in-scope. */
const EU_PREFIXES = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'GR', 'ES', 'FI', 'FR', 'HR', 'HU',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
]);

/** Whether the VAT number carries an EU country prefix (format-level, not existence). */
export function hasEuPrefix(raw: string): boolean {
  const { normalized } = normalizeVat(raw);
  return EU_PREFIXES.has(normalized.slice(0, 2));
}
