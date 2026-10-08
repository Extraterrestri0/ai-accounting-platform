/**
 * LLM provider abstraction (ADR-001 §4–5). The LLM is ONLY a phrasing layer: it receives
 * a deterministic Bulgarian draft and may rephrase it for readability. It never computes,
 * never adds facts (the verifier enforces this downstream), and is entirely optional —
 * the Noop provider returns the draft unchanged (llmUsed=false).
 * Production target: Azure OpenAI in an approved EU region (zero-retention deployment).
 */
export interface LlmRephraseResult {
  text: string;
  model: string;       // e.g. 'azure:gpt-4o/2024-08-06' | 'noop'
  llmUsed: boolean;
}

export interface LlmProvider {
  /** Rephrase a deterministic draft (BG). Implementations must not add information. */
  rephrase(draftMd: string): Promise<LlmRephraseResult>;
}

export const LLM_PROVIDER = Symbol('Assistant.LlmProvider');
