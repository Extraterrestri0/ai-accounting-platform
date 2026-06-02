import { isValidEik } from './eik';

/**
 * EU VAT number FORMAT validation (deterministic). Full validity (existence) is a
 * VIES online check, performed later by a worker (out of scope here). For BG, the
 * numeric part must also be a valid EIK.
 */
const EU_VAT_PATTERNS: Record<string, RegExp> = {
  BG: /^BG\d{9,10}$/, DE: /^DE\d{9}$/, FR: /^FR[A-Z0-9]{2}\d{9}$/, GR: /^EL\d{9}$/,
  RO: /^RO\d{2,10}$/, IT: /^IT\d{11}$/, ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/, NL: /^NL\d{9}B\d{2}$/,
  AT: /^ATU\d{8}$/, PL: /^PL\d{10}$/,
};
export function isValidVatNumberFormat(raw: string): boolean {
  const v = raw.replace(/\s/g, '').toUpperCase();
  const cc = v.startsWith('EL') ? 'GR' : v.slice(0, 2);
  const re = EU_VAT_PATTERNS[cc];
  if (!re || !re.test(v)) return false;
  if (cc === 'BG') return isValidEik(v.slice(2)); // BG VAT = BG + EIK(9/10)
  return true;
}
