import { Injectable, Logger } from '@nestjs/common';
import type { LlmProvider, LlmRephraseResult } from '../application/llm.port';

/**
 * Azure OpenAI adapter (ADR-001 §4) — the intended PRODUCTION phrasing layer.
 * EU residency is asserted at construction (fail-fast), mirroring the Azure Document
 * Intelligence provider. The system prompt forbids adding facts; the verifier downstream
 * enforces it regardless (defense in depth). On ANY error the caller falls back to the
 * deterministic draft — an LLM outage can never break the assistant.
 *
 * Config: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, AZURE_OPENAI_REGION (EU),
 *         AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_API_VERSION (default 2024-06-01).
 */
const EU_REGIONS = new Set([
  'westeurope', 'northeurope', 'francecentral', 'germanywestcentral',
  'swedencentral', 'switzerlandnorth', 'norwayeast', 'polandcentral',
  'italynorth', 'spaincentral',
]);

const SYSTEM_PROMPT =
  'Ти си редактор на български счетоводни обяснения. Преформулирай текста, за да е по-четим и естествен. ' +
  'ЗАБРАНЕНО е да добавяш, променяш или премахваш числа, дати, суми, проценти, номера на документи или правни основания. ' +
  'Запази всички факти точно както са. Върни само преработения текст.';

@Injectable()
export class AzureOpenAiLlmProvider implements LlmProvider {
  private readonly log = new Logger('Assistant.AzureOpenAI');
  private readonly endpoint: string;
  private readonly key: string;
  private readonly deployment: string;
  private readonly apiVersion: string;
  private readonly timeoutMs: number;
  readonly model: string;

  constructor() {
    this.endpoint = (process.env.AZURE_OPENAI_ENDPOINT ?? '').replace(/\/+$/, '');
    this.key = process.env.AZURE_OPENAI_KEY ?? '';
    this.deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? '';
    this.apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? '2024-06-01';
    this.timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 15000);
    if (!this.endpoint || !this.key || !this.deployment) {
      throw new Error('Azure OpenAI selected but AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_KEY / AZURE_OPENAI_DEPLOYMENT are not set.');
    }
    const region = (process.env.AZURE_OPENAI_REGION ?? '').toLowerCase().replace(/\s+/g, '');
    if (process.env.LLM_ALLOW_NON_EU !== 'true') {
      if (!region) throw new Error('AZURE_OPENAI_REGION must be an approved EU region (GDPR/EU residency).');
      if (!EU_REGIONS.has(region)) throw new Error(`AZURE_OPENAI_REGION "${region}" is not an approved EU region.`);
    }
    this.model = `azure:${this.deployment}/${this.apiVersion}`;
  }

  async rephrase(draftMd: string): Promise<LlmRephraseResult> {
    const url = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'api-key': this.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: draftMd }],
          temperature: 0.2, max_tokens: 900,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Azure OpenAI ${res.status}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('empty completion');
      return { text, model: this.model, llmUsed: true };
    } catch (e) {
      // Phrasing is optional: any failure degrades to the deterministic draft.
      this.log.warn(`rephrase failed (${(e as Error).message}) — returning deterministic draft.`);
      return { text: draftMd, model: this.model, llmUsed: false };
    } finally {
      clearTimeout(timer);
    }
  }
}
