import type { MatchSuggestion } from './models';

/** The subset of an AR/AP open item the matcher needs (maps from Payments OpenItem). */
export interface MatchableItem {
  documentType: 'sales_invoice' | 'purchase_invoice';
  documentId: string;
  documentRef?: string;
  counterpartyName?: string;
  dueDate?: string;
  outstanding: string;
  currency: string;
}

export interface MatchInput {
  amount: string;            // signed exact decimal
  transactionType: 'inbound' | 'outbound';
  counterpartyName?: string;
  counterpartyIban?: string;
  reference?: string;
  description?: string;
  bookingDate: string;
  currency: string;
}

const toCents = (s: string): number => Math.round(Number(s) * 100);
const fromCents = (c: number): string => (c / 100).toFixed(2);
const daysBetween = (a: string, b: string): number =>
  Math.abs((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

/** Normalize a counterparty/company name for fuzzy comparison (drop legal suffixes). */
function normName(s?: string): string {
  return (s ?? '').toLowerCase()
    .replace(/[^a-zа-я0-9 ]/gi, ' ')
    .replace(/\b(ood|eood|ad|ead|ltd|llc|gmbh|sa|bv|оод|еоод|ад|еад|дззд)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Dice coefficient on character bigrams — a robust 0..1 string similarity. */
export function nameSimilarity(a?: string, b?: string): number {
  const x = normName(a), y = normName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) ?? 0) + 1); }
    return m;
  };
  const bx = bigrams(x), by = bigrams(y);
  let inter = 0;
  for (const [g, c] of bx) inter += Math.min(c, by.get(g) ?? 0);
  const total = (x.length - 1) + (y.length - 1);
  return total > 0 ? (2 * inter) / total : 0;
}

/** Does the transaction reference/description contain the document number? */
function refContains(input: MatchInput, ref?: string): boolean {
  if (!ref) return false;
  const r = ref.toLowerCase().replace(/[#\s]/g, '');
  if (r.length < 3) return false;
  const text = `${input.reference ?? ''} ${input.description ?? ''}`.toLowerCase().replace(/\s/g, '');
  return text.includes(r);
}

/**
 * Rank AR/AP open items as reconciliation candidates for a bank transaction.
 * Priority (highest confidence wins per item):
 *   1 doc number in reference · 2 exact reference · 3 amount + counterparty ·
 *   4 amount + date proximity · 5 fuzzy counterparty. Never auto-reconciles.
 */
export function suggestMatches(input: MatchInput, items: MatchableItem[], limit = 5): MatchSuggestion[] {
  const wantType = input.transactionType === 'inbound' ? 'sales_invoice' : 'purchase_invoice';
  const amtCents = Math.abs(toCents(input.amount));
  const out: MatchSuggestion[] = [];

  for (const it of items) {
    if (it.documentType !== wantType) continue;
    if (it.currency && input.currency && it.currency !== input.currency) continue;
    const outCents = toCents(it.outstanding);
    if (outCents <= 0) continue;

    const exactAmount = outCents === amtCents;
    const sim = nameSimilarity(input.counterpartyName, it.counterpartyName);
    const refExact = !!it.documentRef && (input.reference ?? '').trim().toLowerCase() === it.documentRef.toLowerCase();
    const refIn = refContains(input, it.documentRef);
    const dateClose = it.dueDate ? daysBetween(input.bookingDate, it.dueDate) <= 7 : false;

    let confidence = 0; let rule = ''; let reason = '';
    if (refIn) { confidence = 0.98; rule = 'doc_number_in_reference'; reason = 'Номер на документ открит в основанието на превода.'; }
    else if (refExact) { confidence = 0.95; rule = 'exact_reference'; reason = 'Точно съвпадение по референция.'; }
    else if (exactAmount && sim >= 0.8) { confidence = 0.9; rule = 'amount_and_counterparty'; reason = 'Точна сума и съвпадащ контрагент.'; }
    else if (exactAmount && dateClose) { confidence = 0.8; rule = 'amount_and_date'; reason = 'Точна сума и близка дата до падежа.'; }
    else if (exactAmount) { confidence = 0.6; rule = 'exact_amount'; reason = 'Точно съвпадение по сума.'; }
    else if (sim >= 0.6 && Math.abs(outCents - amtCents) <= Math.max(1, Math.round(amtCents * 0.01))) { confidence = 0.5; rule = 'fuzzy_counterparty'; reason = 'Сходство по контрагент и близка сума.'; }
    else continue;

    out.push({
      documentType: it.documentType, documentId: it.documentId, documentRef: it.documentRef,
      counterpartyName: it.counterpartyName, outstanding: it.outstanding, currency: it.currency, dueDate: it.dueDate,
      suggestedAmount: fromCents(Math.min(amtCents, outCents)),
      confidence: Math.round(confidence * 100) / 100, rule, reason,
    });
  }

  return out.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}
