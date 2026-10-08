/**
 * Answer verifier (ADR-001 §2): the final text may contain ONLY facts that exist in the
 * tool trace / citations of the deterministic draft. Used to police optional LLM
 * rephrasing — if the LLM changed or invented any number, date or ID, its output is
 * discarded and the deterministic draft is returned (никога халюцинирани цифри).
 */

// Order matters: dates, then UUIDs, then BG space-grouped numbers ("1 200,00"), then plain numbers.
const FACT_RE = /\d{4}-\d{2}-\d{2}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/gi;

/** Extract all literal fact tokens (UUIDs, ISO dates, numbers) from a text. */
export function extractFacts(text: string): string[] {
  return (text.match(FACT_RE) ?? []).map(normalizeFact);
}

/** Normalize so 1200, 1200.00 and "1 200,00" compare equal; dates/uuids pass through. */
export function normalizeFact(tok: string): string {
  const t = tok.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t) || /^[0-9a-f-]{36}$/i.test(t)) return t.toLowerCase();
  const n = parseFloat(t.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? String(+n.toFixed(2)) : t;
}

export interface VerifyResult { ok: boolean; unknownFacts: string[]; }

/**
 * Every fact token in `finalText` must appear in the allowed set (the draft's facts).
 * Small integers (0–31) are exempt — list ordinals/counts phrase naturally ("3 фактури").
 */
export function verifyAnswer(finalText: string, allowedFacts: string[]): VerifyResult {
  const allowed = new Set(allowedFacts.map(normalizeFact));
  const unknown = extractFacts(finalText).filter((f) => {
    if (allowed.has(f)) return false;
    const n = Number(f);
    return !(Number.isInteger(n) && n >= 0 && n <= 31);
  });
  return { ok: unknown.length === 0, unknownFacts: [...new Set(unknown)] };
}
