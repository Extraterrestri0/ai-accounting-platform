/**
 * Bulgarian EIK/BULSTAT checksum validator (9-digit base, 13-digit branch).
 * Deterministic (Invariant 6). Verified against generated samples + known EIK 131071587.
 */
function eik9Check(d: number[]): number {
  let s = 0; for (let i = 0; i < 8; i++) s += d[i] * (i + 1);
  let r = s % 11;
  if (r === 10) { let s2 = 0; for (let i = 0; i < 8; i++) s2 += d[i] * (i + 3); r = s2 % 11; if (r === 10) r = 0; }
  return r;
}
function eik13Check(d: number[]): number {
  const w1 = [2, 7, 3, 5], w2 = [4, 9, 5, 7];
  let s = 0; for (let i = 0; i < 4; i++) s += d[8 + i] * w1[i];
  let r = s % 11;
  if (r === 10) { let s2 = 0; for (let i = 0; i < 4; i++) s2 += d[8 + i] * w2[i]; r = s2 % 11; if (r === 10) r = 0; }
  return r;
}
export function isValidEik(raw: string): boolean {
  if (!/^\d{9}$|^\d{13}$/.test(raw)) return false;
  const d = [...raw].map(Number);
  if (eik9Check(d) !== d[8]) return false;
  if (raw.length === 13 && eik13Check(d) !== d[12]) return false;
  return true;
}
