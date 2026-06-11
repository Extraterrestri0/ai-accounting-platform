import { Injectable } from '@nestjs/common';
import type { LlmProvider, LlmRephraseResult } from '../application/llm.port';

/**
 * Default development provider (ADR-001 §5): returns the deterministic draft UNCHANGED.
 * No simulated AI output, ever — `llmUsed: false` tells the UI (and the audit trail)
 * that this answer is pure deterministic composition.
 */
@Injectable()
export class NoopLlmProvider implements LlmProvider {
  async rephrase(draftMd: string): Promise<LlmRephraseResult> {
    return { text: draftMd, model: 'noop', llmUsed: false };
  }
}
