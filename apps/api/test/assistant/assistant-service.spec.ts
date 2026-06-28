/**
 * AssistantService (ADR-001) — orchestration + safety:
 *  - read-only: a full ask() performs ZERO mutations on accounting data (stubs record calls);
 *  - every answered response has ≥1 citation; citation-less answers become abstentions;
 *  - free-text questions are rejected in Phase 1 (422);
 *  - the AI identity (no userId) cannot ask;
 *  - an LLM that alters figures is discarded (deterministic draft returned, llmUsed=false);
 *  - answers are persisted append-only with model/prompt/rule-card versions + audited.
 */
import { AssistantService } from '../../src/modules/assistant/application/assistant.service';
import type { LlmProvider } from '../../src/modules/assistant/application/llm.port';

type Calls = string[];

function build(opts: { llm?: LlmProvider; vatSummary?: { outputVat: number; deductibleVat: number; vatPayable: number; vatRefundable: number } } = {}) {
  const calls: Calls = [];
  const rec = (name: string) => calls.push(name);
  const inserted: unknown[] = [];
  const audited: { action: string; actorType: string }[] = [];

  const ctx = { currentOrThrow: () => ({ tenantId: 't1', companyId: 'c1', userId: 'u1' }) };
  const db = { run: async (fn: (db: unknown) => unknown) => fn({}) };
  const repo = { insert: async (_db: unknown, _t: string, _c: string, a: unknown) => { inserted.push(a); return 'answer-1'; } };
  const audit = { append: async (_db: unknown, e: { action: string; actorType: string }) => { audited.push(e); } };

  const vat = {
    getSummary: async () => { rec('vat.getSummary'); return opts.vatSummary ?? { outputVat: 320, deductibleVat: 120, vatPayable: 200, vatRefundable: 0 }; },
    getSalesRegister: async () => { rec('vat.getSalesRegister'); return [{ journalEntryId: '11111111-1111-1111-1111-111111111111', kind: 'sales', base: 1600, vat: 320, deductible: 0, treatment: 'standard', rate: 20 }]; },
    getPurchaseRegister: async () => { rec('vat.getPurchaseRegister'); return [{ journalEntryId: '22222222-2222-2222-2222-222222222222', kind: 'purchase', base: 600, vat: 120, deductible: 120, treatment: 'standard', rate: 20 }]; },
    validatePeriod: async () => { rec('vat.validatePeriod'); return []; },
    buildRegisters: async () => { throw new Error('WRITE CALLED'); },
    generateReturn: async () => { throw new Error('WRITE CALLED'); },
  };
  const reviews = {
    getDetail: async () => { rec('reviews.getDetail'); return { package: { id: 'p1' }, extraction: { fields: [] }, suggestion: null, comments: [], actions: [] }; },
    dashboard: async () => { rec('reviews.dashboard'); return { pending: 0, needsCorrection: 0, approved: 1, rejected: 0, assignedToMe: 0 }; },
  };
  const payables = { getPayables: async () => { rec('payables.getPayables'); return []; }, getPayablesSummary: async () => ({}), getPayablesAging: async () => ({}) };
  const receivables = { getReceivables: async () => { rec('receivables.getReceivables'); return []; }, getReceivablesSummary: async () => ({}), getReceivablesAging: async () => ({}) };
  const reports = {
    profitAndLoss: async () => { rec('reports.profitAndLoss'); return { revenue: '100.00', expense: '40.00', netProfit: '60.00', period: { from: '', to: '' } }; },
    trialBalance: async () => { rec('reports.trialBalance'); return { rows: [], totals: { debit: '0', credit: '0', balanced: true }, period: { from: '', to: '' } }; },
  };
  const periods = { isPeriodLocked: async () => { rec('periods.isPeriodLocked'); return false; } };
  const llm: LlmProvider = opts.llm ?? { rephrase: async (d) => ({ text: d, model: 'noop', llmUsed: false }) };

  const svc = new AssistantService(
    ctx as never, db as never, repo as never,
    vat as never, reviews as never, payables as never, receivables as never,
    reports as never, periods as never, llm, audit as never,
  );
  return { svc, calls, inserted, audited, ctx };
}

describe('AssistantService — safety + contract', () => {
  it('answers a VAT question with citations, persists with versions, audits user+ai', async () => {
    const { svc, inserted, audited } = build();
    const a = await svc.ask({ question: { kind: 'key', key: 'vat.payable_why' }, context: { year: 2026, month: 6 } });
    expect(a.abstained).toBe(false);
    expect(a.citations.length).toBeGreaterThanOrEqual(1);     // ADR-001 §3
    expect(a.answer).toContain('320.00');                      // figure from the tool, not invented
    expect(a.llmUsed).toBe(false);                             // Noop default
    expect(a.confidence).toBeGreaterThan(0.9);
    const row = inserted[0] as { promptVersion: string; modelVersion: string; status: string };
    expect(row.promptVersion).toBe('p1.0');
    expect(row.status).toBe('answered');
    expect(audited.map((e) => e.action)).toEqual(['assistant.question_asked', 'assistant.answer_generated']);
    expect(audited[0].actorType).toBe('user');
    expect(audited[1].actorType).toBe('ai');
  });

  it('READ-ONLY: a full ask() never calls any mutating service method', async () => {
    const { svc, calls } = build();
    await svc.ask({ question: { kind: 'key', key: 'vat.payable_why' }, context: { year: 2026, month: 6 } });
    await svc.ask({ question: { kind: 'key', key: 'rp.overdue' } });
    await svc.ask({ question: { kind: 'key', key: 'reports.biggest_expenses' }, context: { year: 2026, month: 6 } });
    // Only read methods were invoked (the write stubs throw 'WRITE CALLED' if touched).
    expect(calls.every((c) => /get|dashboard|profitAndLoss|trialBalance|validatePeriod|isPeriodLocked/.test(c))).toBe(true);
  });

  it('free-text questions are rejected in Phase 1 (422)', async () => {
    const { svc } = build();
    await expect(svc.ask({ question: { kind: 'text', text: 'Колко ДДС дължа?' } })).rejects.toThrow(/не се поддържат/);
  });

  it('the AI identity (no userId) cannot ask — human-only action', async () => {
    const { svc, ctx } = build();
    (ctx as { currentOrThrow: () => unknown }).currentOrThrow = () => ({ tenantId: 't1', companyId: 'c1' });
    await expect(svc.ask({ question: { kind: 'key', key: 'rp.overdue' } })).rejects.toThrow(/human user/);
  });

  it('abstains (status=abstained, confidence 0) when there is no data — never an uncited answer', async () => {
    const { svc, inserted } = build();
    // receivables stub returns [] → customers_owing has nothing to ground an answer in
    const a = await svc.ask({ question: { kind: 'key', key: 'rp.customers_owing' } });
    expect(a.abstained).toBe(true);
    expect(a.confidence).toBe(0);
    expect((inserted[0] as { status: string }).status).toBe('abstained');
  });

  it('discards LLM output that alters a figure (verifier) → deterministic draft, llmUsed=false', async () => {
    const lying: LlmProvider = { rephrase: async (d) => ({ text: d.replace('320.00', '999.99'), model: 'azure:test', llmUsed: true }) };
    const { svc } = build({ llm: lying });
    const a = await svc.ask({ question: { kind: 'key', key: 'vat.payable_why' }, context: { year: 2026, month: 6 } });
    expect(a.answer).toContain('320.00');
    expect(a.answer).not.toContain('999.99');
    expect(a.llmUsed).toBe(false);
  });

  it('accepts LLM output that preserves all facts', async () => {
    const honest: LlmProvider = { rephrase: async (d) => ({ text: 'Преформулирано: ' + d, model: 'azure:test', llmUsed: true }) };
    const { svc } = build({ llm: honest });
    const a = await svc.ask({ question: { kind: 'key', key: 'vat.payable_why' }, context: { year: 2026, month: 6 } });
    expect(a.llmUsed).toBe(true);
    expect(a.answer).toContain('320.00');
  });

  it('unknown question key / missing required context → 422', async () => {
    const { svc } = build();
    await expect(svc.ask({ question: { kind: 'key', key: 'nope' as never } })).rejects.toThrow(/Непознат/);
    await expect(svc.ask({ question: { kind: 'key', key: 'vat.payable_why' } })).rejects.toThrow(/период/);
    await expect(svc.ask({ question: { kind: 'key', key: 'invoice.deductibility' } })).rejects.toThrow(/документ/);
  });

  it('question catalog filters by surface', () => {
    const { svc } = build();
    expect(svc.questions('vat').every((q) => q.surface === 'vat')).toBe(true);
    expect(svc.questions().length).toBe(13);
  });
});
