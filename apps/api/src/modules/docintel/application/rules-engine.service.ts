import { Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { MASTERDATA_SERVICE, type IMasterDataService } from '../../masterdata';
import { EXTRACTION_SERVICE, type IExtractionService } from './extraction.service.interface';
import { RuleRepository } from '../infrastructure/rule.repository';
import { SuggestionRepository } from '../infrastructure/suggestion.repository';
import { ExpenseClassificationService } from './expense-classification.service';
import { aggregateConfidence, matchSupplier, suggestAccount, suggestVat } from '../domain/rules/rules-engine';
import { DocIntelEvents } from '../events';
import type { AccountingSuggestion, CounterpartyRef, PostingLine } from '../domain/rules/models';
import type { CreateRuleInput, IRulesEngineService } from './rules-engine.service.interface';

class RulesError extends Error {}

@Injectable()
export class RulesEngineService implements IRulesEngineService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly rules: RuleRepository,
    private readonly suggestions: SuggestionRepository,
    @Inject(EXTRACTION_SERVICE) private readonly extraction: IExtractionService,
    @Inject(MASTERDATA_SERVICE) private readonly masterdata: IMasterDataService,
    private readonly classification: ExpenseClassificationService,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new RulesError('No active company in context.');
    return { tenantId: c.tenantId, companyId: c.companyId };
  }

  async generateSuggestions(documentId: string): Promise<AccountingSuggestion> {
    const { tenantId, companyId } = this.scope();
    const pkg = await this.extraction.getReviewPackage(documentId); // fields + confidence
    // Overlay human corrections / added fields (from the review package) over the AI extraction.
    const corrected = await this.db.run(async (db) => {
      const r = await db.query<{ corrected_fields: Record<string, string> | null }>(
        `SELECT corrected_fields FROM review_packages WHERE document_id=$1`, [documentId]);
      return r.rows[0]?.corrected_fields ?? {};
    }).catch(() => ({} as Record<string, string>));
    const field = (k: string): string | undefined => corrected[k] ?? pkg.fields.find((f) => f.key === k)?.valueText;

    const counterpartiesPage = await this.masterdata.listCounterparties({ pageSize: 200 });
    const counterparties: CounterpartyRef[] = counterpartiesPage.items.map((c) => ({ id: c.id, name: c.name, eik: c.eik, vatNumber: c.vatNumber, countryCode: c.countryCode }));
    const vatCodes = (await this.masterdata.listVatCodes(true)).map((v) => ({ id: v.id, code: v.code, kind: v.kind }));
    const settings = await this.masterdata.getCompanySettings();
    const countries = await this.masterdata.listCountries();
    const accts = await this.masterdata.getPostingAccounts(); // configured posting accounts (role → code)

    const match = matchSupplier({ eik: field('supplier_eik'), vat: field('supplier_vat'), name: field('supplier_name') }, counterparties);
    const supplierCountry = match.counterparty?.countryCode ?? 'BG';
    const supplierIsEu = countries.find((c) => c.code === supplierCountry)?.isEu ?? true;

    // Expense classification (Task 1.2): memory → deterministic rules → Other.
    const classification = await this.classification.classify({
      counterpartyId: match.counterparty?.id, supplierName: field('supplier_name'), supplierEik: field('supplier_eik'),
      description: [field('payment_method'), field('bank_name'), field('payment_reference')].filter(Boolean).join(' '),
    });

    const result = await this.db.run(async (db) => {
      const activeRules = await this.rules.listActive(db, 'supplier_account');
      const history = match.counterparty ? await this.suggestions.supplierHistory(db, match.counterparty.id) : null;
      const account = suggestAccount({ match, rules: activeRules, history: history ?? undefined, defaultAccountCode: accts.purchase_expense_default });
      const vat = suggestVat({ companyVatRegistered: settings?.vatRegistered ?? false, supplierCountry, supplierIsEu, net: field('net_amount'), vat: field('vat_amount'), vatCodes });

      // The expense account comes from the classified category's default account when set,
      // otherwise the rule/history/default account. The category drives posting (Task 1.2).
      const expenseAccountCode = classification.defaultAccountCode ?? account.accountCode;

      // proposed posting (NOT a journal entry): Dr expense (+ Dr VAT input) / Cr payables.
      // Always balances: when VAT is deductible, expense=net and VAT input=vat (net+vat=gross);
      // otherwise the whole gross is expensed (no input-VAT line) so Dr === Cr.
      const net = field('net_amount'); const vatAmt = field('vat_amount'); const total = field('total_amount');
      const gross = total ?? net;
      const deductVat = !!(vatAmt && vat.treatment !== 'none');
      const expenseDebit = deductVat ? net : gross;
      const posting: PostingLine[] = [];
      if (expenseDebit) posting.push({ accountCode: expenseAccountCode, side: 'debit', amount: expenseDebit });
      if (deductVat) posting.push({ accountCode: accts.purchase_vat_input, side: 'debit', amount: vatAmt as string }); // VAT input (configured)
      if (gross) posting.push({ accountCode: accts.payable, side: 'credit', amount: gross }); // suppliers/payables (configured)

      const invoiceNumber = field('invoice_number');
      const duplicateOf = invoiceNumber ? await this.suggestions.findDuplicateByInvoiceNumber(db, invoiceNumber, documentId) : null;
      const accountId = await this.suggestions.accountIdByCode(db, expenseAccountCode);

      const confidence = aggregateConfidence({ extractionOverall: pkg.overallConfidence, matchConfidence: match.confidence, accountConfidence: account.confidence, vatConfidence: vat.confidence });
      const explanation = [`Категория: ${classification.nameBg ?? classification.categoryCode} (${classification.reason})`, account.explanation, vat.explanation, match.basis === 'none' ? 'Supplier not matched to an existing counterparty.' : `Supplier matched by ${match.basis}.`, duplicateOf ? 'Possible duplicate invoice number detected.' : ''].filter(Boolean).join(' ');

      const id = await this.suggestions.save(db, tenantId, companyId, {
        documentId, extractionId: pkg.extractionId, counterpartyId: match.counterparty?.id, suggestedAccountId: accountId ?? undefined,
        posting, confidence, explanation, isDuplicate: !!duplicateOf, duplicateOf: duplicateOf ?? undefined,
        vat: { treatment: vat.treatment, rate: vat.rate, vatCodeId: vat.codeId ?? undefined, confidence: vat.confidence, explanation: vat.explanation },
        classification: { categoryId: classification.categoryId ?? undefined, confidence: classification.confidence, reason: classification.reason, source: classification.source },
      });
      // audited as the AI actor — proposes only, never posts (Invariant 4)
      await this.audit.append(db, { companyId, actorType: 'ai', action: DocIntelEvents.SuggestionReady, entityType: 'accounting_suggestion', entityId: id, after: { account: expenseAccountCode, vat: vat.treatment, confidence, isDuplicate: !!duplicateOf } });
      await this.audit.append(db, { companyId, actorType: 'ai', action: 'expense.classified', entityType: 'accounting_suggestion', entityId: id, after: { category: classification.categoryCode, confidence: classification.confidence, source: classification.source, reason: classification.reason } });
      return id;
    });

    const saved = await this.getSuggestion(documentId);
    if (!saved) throw new RulesError(`Failed to persist suggestion for document ${documentId} (${result}).`);
    return saved;
  }

  getSuggestion(documentId: string): Promise<AccountingSuggestion | null> {
    this.scope();
    return this.db.run((db) => this.suggestions.getCurrent(db, documentId));
  }

  /** Manual reclassification by a reviewer: sets the category (source='manual') and rewrites
   *  the expense line to the category's default account, keeping the posting balanced. */
  async setSuggestionCategory(suggestionId: string, categoryId: string): Promise<AccountingSuggestion> {
    const { companyId } = this.scope();
    const c = this.ctx.currentOrThrow();
    const userId = c.userId;
    const category = await this.masterdata.getExpenseCategory(categoryId);
    return this.db.run(async (db) => {
      const cur = await this.suggestions.getById(db, suggestionId);
      if (!cur) throw new RulesError(`Suggestion ${suggestionId} not found.`);
      // Rewrite the expense (first debit) line to the category's default account, if it has one.
      let posting = cur.suggestedPosting;
      let suggestedAccountId: string | undefined;
      if (category.defaultAccountCode) {
        const idx = posting.findIndex((l) => l.side === 'debit');
        if (idx >= 0) posting = posting.map((l, i) => (i === idx ? { ...l, accountCode: category.defaultAccountCode! } : l));
        suggestedAccountId = (await this.suggestions.accountIdByCode(db, category.defaultAccountCode)) ?? undefined;
      }
      await this.suggestions.updateCategory(db, suggestionId, { categoryId, source: 'manual', confidence: 1, reason: 'Зададено ръчно от ревюъра.', suggestedAccountId, posting });
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'expense.category_changed', entityType: 'accounting_suggestion', entityId: suggestionId, before: { category: cur.expenseCategory?.code, source: cur.classification?.source }, after: { category: category.code, source: 'manual', confidence: 1 } });
      const updated = await this.suggestions.getById(db, suggestionId);
      if (!updated) throw new RulesError('Suggestion vanished after update.');
      return updated;
    });
  }

  async createRule(input: CreateRuleInput): Promise<{ ruleId: string }> {
    const { tenantId, companyId } = this.scope();
    return this.db.run(async (db) => {
      const ruleId = await this.rules.createRule(db, tenantId, companyId, { ruleType: input.ruleType, name: input.name, matchKey: input.matchKey });
      await this.rules.addVersion(db, tenantId, companyId, ruleId, { match: { matchKey: input.matchKey }, action: { accountCode: input.accountCode, vatCode: input.vatCode, confidence: input.confidence ?? 0.9 } });
      return { ruleId };
    });
  }
}
