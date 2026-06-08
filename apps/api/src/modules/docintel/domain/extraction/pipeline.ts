import { applyValidation, reviewFlags } from './confidence';
import { extractFromText } from './field-extractor';
import { applyHeuristics } from './heuristics';
import type {
  ExtractedField, ExtractionDiagnostics, FieldKey, FieldProvenance, RejectedCandidate, RunMethod,
} from './models';

/**
 * Layered extraction assembler (Invoice extraction reliability). Composes, in order:
 *   1. provider STRUCTURED fields (Document-AI; passed in as `primary`)
 *   2. OCR/born-digital TEXT regex fields (field-extractor)
 *   3. heuristic ACCOUNTING derivation (heuristics) — fills still-missing keys
 *   4. deterministic VALIDATION (confidence) — validators outrank OCR confidence
 *
 * Each layer only ADDS; a value found earlier is never dropped. When several candidates
 * exist for one key, the highest-precedence/confidence wins and the losers are recorded
 * as `rejected` (with a reason) + per-field `alternatives` — surfaced as diagnostics so a
 * missing/derived value is always explainable, never silently discarded.
 */

const PRECEDENCE: Record<string, number> = { vendor: 3, text: 2, derived: 1 };

interface Tagged { f: ExtractedField; layer: string; }

function selectBest(primary: ExtractedField[], textCandidates: ExtractedField[]): {
  fields: ExtractedField[]; rejected: RejectedCandidate[]; provenance: FieldProvenance[];
} {
  const groups = new Map<FieldKey, Tagged[]>();
  const add = (f: ExtractedField, layer: string): void => {
    if (!f.valueText) return;
    const g = groups.get(f.key) ?? [];
    g.push({ f, layer }); groups.set(f.key, g);
  };
  for (const f of primary) add(f, 'vendor');
  for (const f of textCandidates) add(f, 'text');

  const fields: ExtractedField[] = [];
  const rejected: RejectedCandidate[] = [];
  const provenance: FieldProvenance[] = [];

  for (const [key, cands] of groups) {
    const ranked = [...cands].sort((a, b) =>
      (PRECEDENCE[b.layer] - PRECEDENCE[a.layer]) || (b.f.confidence - a.f.confidence));
    const winner = ranked[0];
    fields.push(winner.f);
    const losers = ranked.slice(1);
    if (losers.length) {
      provenance.push({
        key, layer: winner.layer, confidence: winner.f.confidence,
        alternatives: losers.map((l) => ({ value: l.f.valueText!, confidence: l.f.confidence, source: l.f.source })),
      });
      for (const l of losers) {
        if (l.f.valueText === winner.f.valueText) continue; // identical → not worth flagging
        rejected.push({
          key, value: l.f.valueText!, confidence: l.f.confidence, source: l.f.source,
          reason: l.layer === 'vendor' || winner.layer === 'vendor'
            ? `lower-precedence candidate (${winner.layer} won over ${l.layer})`
            : 'lower-confidence duplicate',
        });
      }
    }
  }
  return { fields, rejected, provenance };
}

export interface AssembleInput {
  primary?: ExtractedField[]; text: string;
  engine: string; method: RunMethod; provider?: string; model?: string;
}

export function assemble(input: AssembleInput): { fields: ExtractedField[]; diagnostics: ExtractionDiagnostics } {
  const textCandidates = extractFromText(input.text);
  const sel = selectBest(input.primary ?? [], textCandidates);
  const heur = applyHeuristics(sel.fields);
  const fields = applyValidation(heur.fields);

  const layersRun = ['text', 'heuristics', 'validation'];
  if ((input.primary?.length ?? 0) > 0) layersRun.unshift('vendor');

  const diagnostics: ExtractionDiagnostics = {
    provider: input.provider, model: input.model, engine: input.engine, method: input.method,
    layersRun,
    found: fields.map((f) => f.key),
    derived: heur.notes.map((n) => n.key),
    rejected: sel.rejected,
    missingRequired: reviewFlags(fields).missingRequired,
    provenance: [
      ...sel.provenance,
      ...heur.notes.map((n): FieldProvenance => ({ key: n.key, layer: `heuristics — ${n.reason}`, confidence: fields.find((f) => f.key === n.key)?.confidence ?? 0 })),
    ],
  };
  return { fields, diagnostics };
}

/** Text-only convenience (born-digital / OCR text path + measurement harness). */
export function extractAllLayers(text: string): { fields: ExtractedField[]; diagnostics: ExtractionDiagnostics } {
  return assemble({ text, engine: 'text', method: 'ocr' });
}
