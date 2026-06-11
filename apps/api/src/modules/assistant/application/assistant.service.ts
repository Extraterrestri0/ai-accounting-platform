import { randomUUID } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { VAT_SERVICE, type IVatService } from '../../tax';
import { REVIEW_SERVICE, type IReviewService } from '../../docintel';
import { PAYABLES_SERVICE, RECEIVABLES_SERVICE, type IPayablesService, type IReceivablesService, type OpenItem } from '../../payments';
import { REPORTS_SERVICE, type IReportsService } from '../../reporting';
import { PERIOD_SERVICE, type IAccountingPeriodService } from '../../periods';
import { AiAnswersRepository } from '../infrastructure/ai-answers.repository';
import { LLM_PROVIDER, type LlmProvider } from './llm.port';
import {
  assistantAbstentions, assistantLlmUsed, assistantQuestions, assistantResponseSeconds,
} from '../../../platform/observability/metrics';
import {
  PROMPT_VERSION, QUESTION_CATALOG, QUESTION_KEYS,
  type AnswerDraft, type AskContext, type AskRequest, type AssistantAnswer, type AssistantSurface,
  type Citation, type QuestionCatalogEntry, type QuestionKey, type ToolTraceEntry,
} from '../domain/models';
import { evaluateDeductibility, ruleCardCitation } from '../domain/deductibility';
import { cardById } from '../domain/rule-cards';
import { money, pnlDelta, topExpenses, vatDrivers } from '../domain/delta';
import { extractFacts, verifyAnswer } from '../domain/verifier';
import { CONFIDENCE, applyReviewPenalty, clamp01 } from '../domain/confidence';
import type { IAssistantService } from './assistant.service.interface';

/**
 * AI Accountant Phase 1 (ADR-001) — READ-ONLY grounded explanations.
 *
 * Safety by construction: this service's dependencies are exclusively READ-side
 * application services (VAT registers/summary, review detail, payables/receivables,
 * reports, period status). There is no posting / approval / locking / submission
 * dependency in this module — a hostile prompt has nothing to invoke. The only write
 * is the append-only ai_answers log. Figures come ONLY from tool results; the optional
 * LLM pass may rephrase but the verifier discards any output whose facts drift.
 */
@Injectable()
export class AssistantService implements IAssistantService {
  private readonly log = new Logger('Assistant');
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: AiAnswersRepository,
    @Inject(VAT_SERVICE) private readonly vat: IVatService,
    @Inject(REVIEW_SERVICE) private readonly reviews: IReviewService,
    @Inject(PAYABLES_SERVICE) private readonly payables: IPayablesService,
    @Inject(RECEIVABLES_SERVICE) private readonly receivables: IReceivablesService,
    @Inject(REPORTS_SERVICE) private readonly reports: IReportsService,
    @Inject(PERIOD_SERVICE) private readonly periods: IAccountingPeriodService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
  ) {}

  questions(surface?: AssistantSurface): QuestionCatalogEntry[] {
    return surface ? QUESTION_CATALOG.filter((q) => q.surface === surface) : QUESTION_CATALOG;
  }

  async ask(request: AskRequest): Promise<AssistantAnswer> {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new UnprocessableEntityException('No active company in context.');
    // Questions are a HUMAN action; the AI identity (no userId) cannot ask itself questions.
    if (!c.userId) throw new ForbiddenException('Assistant questions require a human user.');
    const { tenantId, companyId, userId } = c as { tenantId: string; companyId: string; userId: string };

    const q = request.question;
    if (!q || (q.kind !== 'key' && q.kind !== 'text')) throw new UnprocessableEntityException('Невалиден въпрос.');
    if (q.kind === 'text') throw new UnprocessableEntityException('Свободни въпроси не се поддържат все още (Фаза 1 предлага готови въпроси).');
    if (!QUESTION_KEYS.includes(q.key)) throw new UnprocessableEntityException(`Непознат въпрос: ${q.key}`);
    const catalog = QUESTION_CATALOG.find((e) => e.key === q.key)!;
    const ctx = request.context ?? {};
    if (catalog.requires === 'document' && !ctx.documentId) throw new UnprocessableEntityException('Този въпрос изисква документ (documentId).');
    if (catalog.requires === 'period' && !(ctx.year && ctx.month)) throw new UnprocessableEntityException('Този въпрос изисква период (year, month).');

    const t0 = Date.now();
    const trace: ToolTraceEntry[] = [];
    // One UUID links the question event, the persisted answer row and the answer event.
    const answerId = randomUUID();
    await this.db.run((db) => this.audit.append(db, {
      companyId, actorType: 'user', actorId: userId, action: 'assistant.question_asked',
      entityType: 'ai_answer', entityId: answerId, after: { questionKey: q.key, context: ctx },
    }));

    // ---- playbook (deterministic facts + composed BG draft) ----
    let draft: AnswerDraft;
    try {
      draft = await this.runPlaybook(q.key, ctx, trace);
    } catch (e) {
      // A failed read (missing review package, no data) is an abstention, not a 500.
      this.log.warn(`playbook ${q.key} failed: ${(e as Error).message}`);
      draft = this.abstain(`Не мога да отговоря: ${(e as Error).message}`);
    }
    // ADR-001 §3 safety belt: answered without citations is not allowed → abstain.
    if (!draft.abstained && draft.citations.length === 0) {
      draft = this.abstain('Няма източници, с които да обоснова отговор за този въпрос.');
    }

    // ---- optional LLM phrasing + verification (never changes facts) ----
    let finalText = draft.answerMd;
    let llmUsed = false;
    let model = 'noop';
    if (!draft.abstained) {
      const polished = await this.llm.rephrase(draft.answerMd);
      model = polished.model;
      if (polished.llmUsed) {
        const allowed = [...draft.facts, ...extractFacts(draft.answerMd)];
        const check = verifyAnswer(polished.text, allowed);
        if (check.ok) { finalText = polished.text; llmUsed = true; }
        else this.log.warn(`LLM output rejected (unknown facts: ${check.unknownFacts.join(', ')}) — deterministic draft returned.`);
      }
    }

    const responseMs = Date.now() - t0;
    const status = draft.abstained ? 'abstained' : 'answered';
    const id = await this.db.run(async (db) => {
      await this.repo.insert(db, tenantId, companyId, {
        id: answerId, questionKind: 'key', questionKey: q.key, context: ctx, status,
        answerMd: finalText, citations: draft.citations, confidence: draft.confidence,
        toolTrace: trace, llmUsed, modelVersion: model, promptVersion: PROMPT_VERSION,
        ruleCardVersions: draft.ruleCardVersions, responseMs, askedBy: userId,
      });
      await this.audit.append(db, {
        companyId, actorType: 'ai', action: draft.abstained ? 'assistant.answer_abstained' : 'assistant.answer_generated',
        entityType: 'ai_answer', entityId: answerId,
        after: { questionKey: q.key, confidence: draft.confidence, citations: draft.citations.length, llmUsed, model, promptVersion: PROMPT_VERSION, responseMs },
      });
      return answerId;
    });

    assistantQuestions.inc({ question_key: q.key });
    assistantResponseSeconds.observe(responseMs / 1000);
    if (draft.abstained) assistantAbstentions.inc();
    if (llmUsed) assistantLlmUsed.inc();

    return {
      id, answer: finalText, citations: draft.citations, confidence: draft.confidence,
      llmUsed, abstained: !!draft.abstained, generatedAt: new Date().toISOString(),
    };
  }

  // ===================== playbooks =====================

  private async runPlaybook(key: QuestionKey, ctx: AskContext, trace: ToolTraceEntry[]): Promise<AnswerDraft> {
    switch (key) {
      case 'vat.payable_why': return this.vatPayableWhy(ctx, trace);
      case 'vat.payable_sources': return this.vatPayableSources(ctx, trace);
      case 'vat.prefiling_checklist': return this.vatPrefiling(ctx, trace);
      case 'invoice.posting_why': return this.invoicePostingWhy(ctx, trace);
      case 'invoice.treatment_why': return this.invoiceTreatmentWhy(ctx, trace);
      case 'invoice.deductibility': return this.invoiceDeductibility(ctx, trace);
      case 'invoice.rule_source': return this.invoiceRuleSource(ctx, trace);
      case 'rp.overdue': return this.rpOverdue(trace);
      case 'rp.customers_owing': return this.rpCustomersOwing(trace);
      case 'rp.pay_first': return this.rpPayFirst(trace);
      case 'reports.profit_why': return this.reportsProfitWhy(ctx, trace, 'why');
      case 'reports.month_diff': return this.reportsProfitWhy(ctx, trace, 'diff');
      case 'reports.biggest_expenses': return this.reportsBiggestExpenses(ctx, trace);
    }
  }

  private async tool<T>(trace: ToolTraceEntry[], tool: string, args: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now();
    const result = await fn();
    const json = JSON.stringify(result) ?? '';
    trace.push({ tool, args, resultDigest: `${json.length}b`, ms: Date.now() - t0 });
    return result;
  }

  private abstain(reasonBg: string): AnswerDraft {
    return { answerMd: reasonBg, citations: [], confidence: CONFIDENCE.ABSTAINED, ruleCardVersions: {}, facts: [], abstained: true };
  }

  private monthLabel(y: number, m: number): string { return `${String(m).padStart(2, '0')}.${y}`; }
  private periodOf(y: number, m: number): { from: string; to: string } {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
  }

  // ---- VAT ----

  private async vatPayableWhy(ctx: AskContext, trace: ToolTraceEntry[]): Promise<AnswerDraft> {
    const { year, month } = ctx as { year: number; month: number };
    const summary = await this.tool(trace, 'vat.summary', { year, month }, () => this.vat.getSummary(year, month));
    const sales = await this.tool(trace, 'vat.salesRegister', { year, month }, () => this.vat.getSalesRegister(year, month));
    const purchases = await this.tool(trace, 'vat.purchaseRegister', { year, month }, () => this.vat.getPurchaseRegister(year, month));
    if (sales.length === 0 && purchases.length === 0) return this.abstain(`Няма построени ДДС регистри за ${this.monthLabel(year, month)}. Построй регистрите от страницата ДДС и попитай отново.`);

    const d = vatDrivers(sales, purchases);
    const lines: string[] = [];
    const result = summary.vatPayable > 0
      ? `За ${this.monthLabel(year, month)} дължиш **${money(summary.vatPayable)}** ДДС.`
      : `За ${this.monthLabel(year, month)} не дължиш ДДС — имаш **${money(summary.vatRefundable)}** за възстановяване/приспадане.`;
    lines.push(result);
    lines.push(`Начислен ДДС по продажби: **${money(summary.outputVat)}** · данъчен кредит по покупки: **${money(summary.deductibleVat)}**. Резултатът е разликата между двете.`);
    const citations: Citation[] = [{ type: 'report_cell', id: `vat-summary-${year}-${month}`, label: `ДДС обобщение ${this.monthLabel(year, month)}`, href: '/vat', fact: money(summary.vatPayable > 0 ? summary.vatPayable : summary.vatRefundable) }];
    if (d.topOutput.length) {
      lines.push('Най-големи източници на начислен ДДС (продажби):');
      for (const r of d.topOutput) {
        lines.push(`— ${r.documentRef ?? 'запис'} ${r.journalEntryId.slice(0, 8)}: ДДС ${money(r.vat)} върху основа ${money(r.base)}`);
        citations.push({ type: 'vat_register_row', id: r.journalEntryId, label: `Продажба ${r.documentRef ?? r.journalEntryId.slice(0, 8)}`, href: '/vat', fact: money(r.vat) });
      }
    }
    if (d.topDeductible.length) {
      lines.push('Най-голям данъчен кредит (покупки):');
      for (const r of d.topDeductible) {
        lines.push(`— ${r.documentRef ?? 'запис'} ${r.journalEntryId.slice(0, 8)}: кредит ${money(r.deductible)}`);
        citations.push({ type: 'vat_register_row', id: r.journalEntryId, label: `Покупка ${r.documentRef ?? r.journalEntryId.slice(0, 8)}`, href: '/vat', fact: money(r.deductible) });
      }
    }
    const answerMd = lines.join('\n');
    return { answerMd, citations, confidence: CONFIDENCE.GROUNDED_DATA, ruleCardVersions: {}, facts: extractFacts(answerMd) };
  }

  private async vatPayableSources(ctx: AskContext, trace: ToolTraceEntry[]): Promise<AnswerDraft> {
    const { year, month } = ctx as { year: number; month: number };
    const sales = await this.tool(trace, 'vat.salesRegister', { year, month }, () => this.vat.getSalesRegister(year, month));
    const purchases = await this.tool(trace, 'vat.purchaseRegister', { year, month }, () => this.vat.getPurchaseRegister(year, month));
    if (sales.length === 0 && purchases.length === 0) return this.abstain(`Няма редове в регистрите за ${this.monthLabel(year, month)}.`);
    const lines = [`Записи, формиращи ДДС резултата за ${this.monthLabel(year, month)}:`];
    const citations: Citation[] = [];
    if (sales.length) {
      lines.push(`Продажби (${sales.length}):`);
      for (const r of sales.slice(0, 10)) {
        lines.push(`— ${r.journalEntryId.slice(0, 8)}: основа ${money(r.base)}, ДДС ${money(r.vat)}`);
        citations.push({ type: 'vat_register_row', id: r.journalEntryId, label: `Продажба ${r.journalEntryId.slice(0, 8)}`, href: '/vat', fact: money(r.vat) });
      }
    }
    if (purchases.length) {
      lines.push(`Покупки (${purchases.length}):`);
      for (const r of purchases.slice(0, 10)) {
        lines.push(`— ${r.journalEntryId.slice(0, 8)}: основа ${money(r.base)}, данъчен кредит ${money(r.deductible)}`);
        citations.push({ type: 'vat_register_row', id: r.journalEntryId, label: `Покупка ${r.journalEntryId.slice(0, 8)}`, href: '/vat', fact: money(r.deductible) });
      }
    }
    const answerMd = lines.join('\n');
    return { answerMd, citations, confidence: CONFIDENCE.GROUNDED_DATA, ruleCardVersions: {}, facts: extractFacts(answerMd) };
  }

  private async vatPrefiling(ctx: AskContext, trace: ToolTraceEntry[]): Promise<AnswerDraft> {
    const { year, month } = ctx as { year: number; month: number };
    const issues = await this.tool(trace, 'vat.validate', { year, month }, () => this.vat.validatePeriod(year, month));
    const dash = await this.tool(trace, 'reviews.dashboard', {}, () => this.reviews.dashboard());
    const locked = await this.tool(trace, 'periods.isLocked', { year, month }, () => this.periods.isPeriodLocked(year, month));
    const lines = [`Проверка преди подаване за ${this.monthLabel(year, month)}:`];
    const citations: Citation[] = [{ type: 'period', id: `${year}-${month}`, label: `Период ${this.monthLabel(year, month)}`, href: '/vat' }];
    lines.push(issues.length === 0 ? '— Валидация на регистрите: без открити проблеми.' : `— Валидация: ${issues.length} проблем(а) — прегледай ги преди подаване.`);
    for (const i of issues.slice(0, 5)) {
      lines.push(`   • ${i.code} (запис ${i.journalEntryId.slice(0, 8)})`);
      citations.push({ type: 'vat_register_row', id: i.journalEntryId, label: `Проблем: ${i.code}`, href: '/vat' });
    }
    lines.push(dash.pending === 0 ? '— Чакащи прегледи: няма.' : `— Чакащи прегледи: **${dash.pending}** документа не са одобрени/осчетоводени — реши ги или ще липсват от периода.`);
    if (dash.pending > 0) citations.push({ type: 'document', id: 'review-queue', label: 'Опашка за преглед', href: '/review', fact: String(dash.pending) });
    lines.push(locked ? '— Периодът е заключен: данните няма да се променят.' : '— Периодът още не е заключен — заключи го след подаване, за да не се променя.');
    lines.push('— Срок: подаване до 14-о число на следващия месец (чл. 125 ЗДДС).');
    citations.push(ruleCardCitation(cardById('vat.filing_deadline')!));
    const answerMd = lines.join('\n');
    return { answerMd, citations, confidence: applyReviewPenalty(CONFIDENCE.GROUNDED_DATA, citations), ruleCardVersions: { 'vat.filing_deadline': '1.0' }, facts: extractFacts(answerMd) };
  }

  // ---- Invoice ----

  private async invoiceDetail(documentId: string, trace: ToolTraceEntry[]) {
    return this.tool(trace, 'reviews.getDetail', { documentId }, () => this.reviews.getDetail(documentId));
  }

  private async invoicePostingWhy(ctx: AskContext, trace: ToolTraceEntry[]): Promise<AnswerDraft> {
    const detail = await this.invoiceDetail(ctx.documentId!, trace);
    const sug = detail.suggestion as { suggestedPosting?: { accountCode: string; side: string; amount: string }[]; explanation?: string } | null;
    if (!sug?.suggestedPosting?.length) return this.abstain('За този документ няма осчетоводително предложение — генерирай предложение от прегледа.');
    const lines = ['Предложеното осчетоводяване е:'];
    for (const l of sug.suggestedPosting) lines.push(`— ${l.side === 'debit' ? 'Дт' : 'Кт'} ${l.accountCode}: ${l.amount}`);
    if (sug.explanation) lines.push(`Обяснение на правилата: ${sug.explanation}`);
    const citations: Citation[] = [{ type: 'document', id: ctx.documentId!, label: 'Документът', href: `/review/${ctx.documentId}` }];
    const posting = (detail as { posting?: { journalEntryId?: string } }).posting;
    if (posting?.journalEntryId) citations.push({ type: 'journal_entry', id: posting.journalEntryId, label: `Запис ${posting.journalEntryId.slice(0, 8)}`, href: '/posting' });
    const answerMd = lines.join('\n');
    return { answerMd, citations, confidence: CONFIDENCE.EXPLANATION, ruleCardVersions: {}, facts: extractFacts(answerMd) };
  }

  private async invoiceTreatmentWhy(ctx: AskContext, trace: ToolTraceEntry[]): Promise<AnswerDraft> {
    const detail = await this.invoiceDetail(ctx.documentId!, trace);
    const sug = detail.suggestion as { vat?: { treatment: string; rate: number; explanation?: string } } | null;
    if (!sug?.vat) return this.abstain('За този документ няма ДДС предложение.');
    const treatBg: Record<string, string> = { standard: 'стандартна ставка', reduced: 'намалена ставка', exempt: 'освободена доставка', reverse_charge: 'обратно начисляване', intra_community: 'вътреобщностна' };
    const lines = [`Избраното третиране е **${treatBg[sug.vat.treatment] ?? sug.vat.treatment}** при ставка **${sug.vat.rate}%**.`];
    if (sug.vat.explanation) lines.push(`Основание от правилата: ${sug.vat.explanation}`);
    const cardId = sug.vat.treatment === 'standard' ? 'vat.standard_rate' : sug.vat.treatment === 'reduced' ? 'vat.reduced_rate_9' : sug.vat.treatment === 'reverse_charge' ? 'vat.reverse_charge' : sug.vat.treatment === 'intra_community' ? 'vat.intra_community' : sug.vat.treatment === 'exempt' ? 'vat.exempt_supplies' : null;
    const citations: Citation[] = [{ type: 'document', id: ctx.documentId!, label: 'Документът', href: `/review/${ctx.documentId}` }];
    const ruleCardVersions: Record<string, string> = {};
    if (cardId) { const card = cardById(cardId)!; citations.push(ruleCardCitation(card)); ruleCardVersions[card.id] = card.version; }
    const answerMd = lines.join('\n');
    return { answerMd, citations, confidence: applyReviewPenalty(CONFIDENCE.EXPLANATION, citations), ruleCardVersions, facts: extractFacts(answerMd) };
  }

  private async invoiceDeductibility(ctx: AskContext, trace: ToolTraceEntry[]): Promise<AnswerDraft> {
    const detail = await this.invoiceDetail(ctx.documentId!, trace);
    const fields = (detail.extraction?.fields ?? []) as { key: string; valueText?: string }[];
    const get = (k: string) => fields.find((f) => f.key === k)?.valueText;
    const sug = detail.suggestion as { vat?: { treatment: string }; expenseCategory?: { code?: string }; classification?: { reason?: string } } | null;
    const result = evaluateDeductibility({
      asOfISO: get('invoice_date') ?? new Date().toISOString().slice(0, 10),
      vatTreatment: sug?.vat?.treatment ?? get('vat_treatment'),
      vatAmount: parseFloat(get('vat_amount') ?? '') || undefined,
      expenseCategoryCode: sug?.expenseCategory?.code,
      descriptionText: [get('description'), get('notes')].filter(Boolean).join(' '),
    });
    if (result.verdict === 'unknown') return this.abstain(result.reasonBg + ' Допълни полетата в прегледа и опитай отново.');
    const verdictBg = result.verdict === 'deductible' ? 'Да — има право на данъчен кредит.'
      : result.verdict === 'not_deductible' ? 'Не — няма право на данъчен кредит.'
      : 'Самоначисляване — данъкът се начислява и (при право) приспада от получателя.';
    const lines = [verdictBg, result.reasonBg, '⚠ Информативно — не е данъчна консултация. Провери конкретните обстоятелства.'];
    const citations: Citation[] = [{ type: 'document', id: ctx.documentId!, label: 'Документът', href: `/review/${ctx.documentId}` }];
    const ruleCardVersions: Record<string, string> = {};
    if (result.card) { citations.push(ruleCardCitation(result.card)); ruleCardVersions[result.card.id] = result.card.version; }
    const base = result.card?.reviewedBy ? CONFIDENCE.RULE_REVIEWED : CONFIDENCE.RULE_PENDING;
    const answerMd = lines.join('\n');
    return { answerMd, citations, confidence: clamp01(base), ruleCardVersions, facts: extractFacts(answerMd) };
  }

  private async invoiceRuleSource(ctx: AskContext, trace: ToolTraceEntry[]): Promise<AnswerDraft> {
    const detail = await this.invoiceDetail(ctx.documentId!, trace);
    const sug = detail.suggestion as { classification?: { source?: string; reason?: string; confidence?: number }; explanation?: string } | null;
    if (!sug) return this.abstain('За този документ няма предложение.');
    const srcBg: Record<string, string> = { rule: 'детерминистично правило', memory: 'памет за контрагента (предишни фактури)', manual: 'ръчен избор', ai: 'AI класификация' };
    const lines: string[] = [];
    if (sug.classification?.source) lines.push(`Категорията идва от: **${srcBg[sug.classification.source] ?? sug.classification.source}**.`);
    if (sug.classification?.reason) lines.push(`Причина: ${sug.classification.reason}`);
    if (sug.explanation) lines.push(`Осчетоводяване: ${sug.explanation}`);
    if (!lines.length) return this.abstain('Предложението няма записана причина.');
    const citations: Citation[] = [{ type: 'document', id: ctx.documentId!, label: 'Документът и предложението', href: `/review/${ctx.documentId}` }];
    const answerMd = lines.join('\n');
    return { answerMd, citations, confidence: CONFIDENCE.EXPLANATION, ruleCardVersions: {}, facts: extractFacts(answerMd) };
  }

  // ---- Receivables / Payables ----

  private openItemLine(i: OpenItem): string {
    return `— ${i.documentRef ?? i.documentId.slice(0, 8)}${i.counterpartyName ? ` (${i.counterpartyName})` : ''}: ${i.outstanding} ${i.currency}${i.overdueDays && i.overdueDays > 0 ? `, просрочие ${i.overdueDays} дни` : ''}`;
  }

  private async rpOverdue(trace: ToolTraceEntry[]): Promise<AnswerDraft> {
    const rec = await this.tool(trace, 'receivables.list', {}, () => this.receivables.getReceivables());
    const pay = await this.tool(trace, 'payables.list', {}, () => this.payables.getPayables());
    const or = rec.filter((i) => (i.overdueDays ?? 0) > 0);
    const op = pay.filter((i) => (i.overdueDays ?? 0) > 0);
    if (or.length === 0 && op.length === 0) {
      const answerMd = 'Няма просрочени фактури — нито за получаване, нито за плащане. ✓';
      return { answerMd, citations: [{ type: 'receivable', id: 'none', label: 'Вземания', href: '/receivables' }], confidence: CONFIDENCE.GROUNDED_DATA, ruleCardVersions: {}, facts: extractFacts(answerMd) };
    }
    const lines: string[] = [];
    const citations: Citation[] = [];
    if (or.length) {
      lines.push(`Просрочени вземания (${or.length}):`);
      for (const i of or.slice(0, 8)) { lines.push(this.openItemLine(i)); citations.push({ type: 'receivable', id: i.documentId, label: `Вземане ${i.documentRef ?? ''}`.trim(), href: '/receivables', fact: i.outstanding }); }
    }
    if (op.length) {
      lines.push(`Просрочени задължения (${op.length}):`);
      for (const i of op.slice(0, 8)) { lines.push(this.openItemLine(i)); citations.push({ type: 'payable', id: i.documentId, label: `Задължение ${i.documentRef ?? ''}`.trim(), href: '/payables', fact: i.outstanding }); }
    }
    const answerMd = lines.join('\n');
    return { answerMd, citations, confidence: CONFIDENCE.GROUNDED_DATA, ruleCardVersions: {}, facts: extractFacts(answerMd) };
  }

  private async rpCustomersOwing(trace: ToolTraceEntry[]): Promise<AnswerDraft> {
    const rec = await this.tool(trace, 'receivables.list', {}, () => this.receivables.getReceivables());
    if (rec.length === 0) return this.abstain('Няма отворени вземания — никой не ти дължи пари в момента.');
    const byCp = new Map<string, { name: string; total: number; count: number }>();
    for (const i of rec) {
      const k = i.counterpartyName ?? 'Неизвестен клиент';
      const e = byCp.get(k) ?? { name: k, total: 0, count: 0 };
      e.total += parseFloat(i.outstanding) || 0; e.count += 1; byCp.set(k, e);
    }
    const top = [...byCp.values()].sort((a, b) => b.total - a.total).slice(0, 8);
    const lines = ['Клиенти с неплатени фактури:'];
    for (const c of top) lines.push(`— ${c.name}: **${money(c.total)}** (${c.count} фактури)`);
    const citations: Citation[] = top.map((c) => ({ type: 'receivable' as const, id: c.name, label: c.name, href: '/receivables', fact: money(c.total) }));
    const answerMd = lines.join('\n');
    return { answerMd, citations, confidence: CONFIDENCE.GROUNDED_DATA, ruleCardVersions: {}, facts: extractFacts(answerMd) };
  }

  private async rpPayFirst(trace: ToolTraceEntry[]): Promise<AnswerDraft> {
    const pay = await this.tool(trace, 'payables.list', {}, () => this.payables.getPayables());
    if (pay.length === 0) return this.abstain('Няма отворени задължения към доставчици.');
    const ranked = [...pay].sort((a, b) => (b.overdueDays ?? 0) - (a.overdueDays ?? 0) || String(a.dueDate ?? '').localeCompare(String(b.dueDate ?? '')));
    const lines = ['Приоритет за плащане (най-просрочените първо):'];
    const citations: Citation[] = [];
    for (const i of ranked.slice(0, 8)) {
      lines.push(this.openItemLine(i));
      citations.push({ type: 'payable', id: i.documentId, label: `Задължение ${i.documentRef ?? ''}`.trim(), href: '/payables', fact: i.outstanding });
    }
    const answerMd = lines.join('\n');
    return { answerMd, citations, confidence: CONFIDENCE.GROUNDED_DATA, ruleCardVersions: {}, facts: extractFacts(answerMd) };
  }

  // ---- Reports ----

  private async reportsProfitWhy(ctx: AskContext, trace: ToolTraceEntry[], mode: 'why' | 'diff'): Promise<AnswerDraft> {
    const { year, month } = ctx as { year: number; month: number };
    const prevY = month === 1 ? year - 1 : year; const prevM = month === 1 ? 12 : month - 1;
    const cur = await this.tool(trace, 'reports.pnl', { year, month }, () => this.reports.profitAndLoss(this.periodOf(year, month)));
    const prev = await this.tool(trace, 'reports.pnl', { year: prevY, month: prevM }, () => this.reports.profitAndLoss(this.periodOf(prevY, prevM)));
    const d = pnlDelta(cur, prev);
    if (d.driver === 'none' && d.netProfit.current === 0 && d.netProfit.previous === 0) return this.abstain(`Няма осчетоводени приходи/разходи за ${this.monthLabel(year, month)} и ${this.monthLabel(prevY, prevM)}.`);
    const dir = d.netProfit.change < 0 ? 'по-нисък' : d.netProfit.change > 0 ? 'по-висок' : 'без промяна';
    const lines = [
      `Финансов резултат за ${this.monthLabel(year, month)}: **${money(d.netProfit.current)}** (предходен месец: ${money(d.netProfit.previous)} → ${dir} с ${money(Math.abs(d.netProfit.change))}).`,
      `Приходи: ${money(d.revenue.current)} (промяна ${money(d.revenue.change)}) · Разходи: ${money(d.expense.current)} (промяна ${money(d.expense.change)}).`,
    ];
    if (mode === 'why') {
      lines.push(d.driver === 'revenue' ? 'Основният двигател е промяната в **приходите**.'
        : d.driver === 'expense' ? 'Основният двигател е промяната в **разходите**.'
        : d.driver === 'both' ? 'Промяната идва и от приходите, и от разходите.'
        : 'Няма съществена промяна между двата месеца.');
    }
    const citations: Citation[] = [
      { type: 'report_cell', id: `pnl-${year}-${month}`, label: `ОПР ${this.monthLabel(year, month)}`, href: '/reports', fact: money(d.netProfit.current) },
      { type: 'report_cell', id: `pnl-${prevY}-${prevM}`, label: `ОПР ${this.monthLabel(prevY, prevM)}`, href: '/reports', fact: money(d.netProfit.previous) },
    ];
    const answerMd = lines.join('\n');
    return { answerMd, citations, confidence: CONFIDENCE.GROUNDED_DATA, ruleCardVersions: {}, facts: extractFacts(answerMd) };
  }

  private async reportsBiggestExpenses(ctx: AskContext, trace: ToolTraceEntry[]): Promise<AnswerDraft> {
    const { year, month } = ctx as { year: number; month: number };
    const tb = await this.tool(trace, 'reports.trialBalance', { year, month }, () => this.reports.trialBalance(this.periodOf(year, month)));
    const top = topExpenses(tb.rows);
    if (top.length === 0) return this.abstain(`Няма осчетоводени разходи за ${this.monthLabel(year, month)}.`);
    const lines = [`Най-големи разходи за ${this.monthLabel(year, month)}:`];
    const citations: Citation[] = [];
    for (const e of top) {
      lines.push(`— ${e.accountCode} ${e.accountName}: **${money(e.amount)}**`);
      citations.push({ type: 'report_cell', id: `tb-${e.accountCode}`, label: `Сметка ${e.accountCode} ${e.accountName}`, href: '/reports', fact: money(e.amount) });
    }
    const answerMd = lines.join('\n');
    return { answerMd, citations, confidence: CONFIDENCE.GROUNDED_DATA, ruleCardVersions: {}, facts: extractFacts(answerMd) };
  }
}
