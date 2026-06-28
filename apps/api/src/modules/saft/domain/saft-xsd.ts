/**
 * SAF-T XSD validation result shape (Phase 4). Pure domain — no I/O, no schema specifics.
 *
 * `ok`:
 *   - true  → XML validated against the configured schema with no errors
 *   - false → XML failed schema validation (see errors[])
 *   - null  → NOT validated (no XSD configured) — the harness is inert by default
 */
export interface XsdValidationIssue {
  message: string;
  line?: number;
  column?: number;
}

export interface XsdValidationResult {
  ok: boolean | null;
  errors: XsdValidationIssue[];
  schemaVersion: string | null;
}

/** Raw libxml2 error detail (message + 1-based line/col; 0 means "unknown"). */
export interface RawXsdErrorDetail { message?: string; line?: number; col?: number; }

/** Normalize raw libxml2 error details into portable issues (pure; testable without WASM). */
export function normalizeXsdErrors(details: RawXsdErrorDetail[] | undefined): XsdValidationIssue[] {
  return (details ?? []).map((d) => {
    const issue: XsdValidationIssue = { message: (d.message ?? '').trim() || 'Unknown schema validation error' };
    if (typeof d.line === 'number' && d.line > 0) issue.line = d.line;
    if (typeof d.col === 'number' && d.col > 0) issue.column = d.col;
    return issue;
  });
}
