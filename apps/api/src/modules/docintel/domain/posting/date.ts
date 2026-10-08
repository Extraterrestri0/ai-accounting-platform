/**
 * Posting-date parsing for the document-driven flow. A confirmed posting date must be a real
 * calendar date in strict YYYY-MM-DD form — no locale parsing, no Date() fallback. Used to
 * validate the human-confirmed date before it reaches the ledger (which then enforces the
 * open-period gate). Returns the normalized YYYY-MM-DD string, or null if invalid/absent.
 */
export function parsePostingDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y), month = Number(mo), day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // reject impossible calendar dates (e.g. 2026-02-30) via round-trip in UTC
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
  return `${y}-${mo}-${d}`;
}
