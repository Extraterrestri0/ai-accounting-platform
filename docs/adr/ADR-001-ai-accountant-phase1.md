# ADR-001 — AI Accountant (Module 11), Phase 1: read-only grounded explanations

- **Status:** accepted (product owner approval, 2026-06-12 — constitutes the §15 sign-off to build the Phase-2 AI scope as a read-only explain layer)
- **Scope:** `modules/assistant` — 13 fixed questions (VAT / Invoice / Receivables-Payables / Reports), question-chip UI, no free chat, no memory, no autonomous actions.

## Decisions & rationale

### 1. The assistant is read-only — structurally, not by policy
The platform's trust contract (CLAUDE.md §2.4–2.5) is "AI proposes, human decides". The assistant's value is *explanation*; any write capability would put a model output one step from the ledger. Enforcement is structural:
- the module's DI graph contains **only read-side application services** (VAT, reviews read, payables/receivables, reports, periods read) — there is no posting/approve/lock/submit dependency to call;
- it writes only to its own append-only `ai_answers` table (INSERT + SELECT grants);
- privileged services keep their `requireHuman()` gates regardless.

### 2. All figures come from deterministic services
LLMs cannot be trusted with arithmetic or tax facts (Invariant §2.6). Every number, date and ID in an answer is interpolated from tool results produced by the existing engines (ledger projections, VAT registers, aging reports). The LLM never computes; it may only rephrase a deterministic draft. A **verifier** rejects any LLM output whose facts diverge from the tool trace — the deterministic draft is returned instead.

### 3. Citations are mandatory
An explanation the user cannot verify is a liability. Every answered response carries ≥1 citation linking each claim to its source (journal entry, document, VAT register row, report, rule card) — enforced by a DB CHECK (`answered_needs_citations`) and a service assert. **No citations ⇒ abstain**, never answer.

### 4. Azure OpenAI (EU) is the intended production provider
Invariant §2.7 (EU-resident, zero-retention) excludes default OpenAI endpoints. Azure OpenAI offers EU-region deployments with no-training/zero-retention terms, matching the Azure Document Intelligence precedent already in the codebase (EU region asserted at construction, fail-fast).

### 5. NoopLlmProvider is the development default
No LLM credentials exist in development, and this codebase's honesty rule (established in the OCR work) is **never simulate AI output**. The Noop provider returns the deterministic draft unchanged (`llmUsed: false`) — the product is fully functional without an LLM, which also proves the LLM is purely a phrasing layer.

### 6. Knowledge = curated, versioned rule cards — not model memory
Bulgarian tax rules are encoded as effective-dated rule cards with `legalReference`, `version`, and explicit accountant-review flags (`reviewedBy`/`reviewedAt`). Cards not yet reviewed are usable but flagged (`reviewPending`) in every citation; "all cards reviewed" is a beta-exit checklist item. Models never recall law from weights.

### 7. Future-proof question model
The request model is `{ question: { kind: 'key' | 'text', ... }, context }`. Phase 1 accepts only `kind:'key'` (422 otherwise); conversational input later extends the same module without redesign.

## Consequences
- Hallucinated figures are impossible by construction when Noop is active, and are caught by the verifier when an LLM is active.
- Observability from day one: `assistant_questions_total{question_key}`, `assistant_response_seconds`, `assistant_abstentions_total`, `assistant_llm_used_total` + the queryable `ai_answers` table.
- Audit: question asked (actor = user) and answer generated/abstained (actor = ai, with model + prompt + rule-card versions) enter the hash chain.
