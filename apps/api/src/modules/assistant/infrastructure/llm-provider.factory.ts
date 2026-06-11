import { Logger } from '@nestjs/common';
import type { LlmProvider } from '../application/llm.port';
import { AzureOpenAiLlmProvider } from './azure-openai-llm.provider';
import { NoopLlmProvider } from './noop-llm.provider';

/**
 * LLM provider selection (ADR-001 §5): Noop is the DEFAULT — the Azure provider is used
 * only when explicitly selected AND fully configured (it fail-fasts otherwise). There is
 * no silent fallback to a non-EU endpoint and no simulated output.
 *   LLM_PROVIDER=azure  → Azure OpenAI (EU region asserted)
 *   LLM_PROVIDER unset  → NoopLlmProvider (deterministic drafts, llmUsed=false)
 */
export function createLlmProvider(env: NodeJS.ProcessEnv = process.env): LlmProvider {
  const log = new Logger('Assistant.LlmFactory');
  const choice = (env.LLM_PROVIDER ?? 'none').toLowerCase();
  if (choice === 'azure') {
    log.log('LLM provider: Azure OpenAI (EU).');
    return new AzureOpenAiLlmProvider();
  }
  log.log('LLM provider: none (deterministic drafts only).');
  return new NoopLlmProvider();
}
