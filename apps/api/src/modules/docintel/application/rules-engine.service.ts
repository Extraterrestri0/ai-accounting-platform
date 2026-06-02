import { Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { MASTERDATA_SERVICE, type IMasterDataService } from '../../masterdata';
import { EXTRACTION_SERVICE, type IExtractionService } from './extraction.service.interface';
import { RuleRepository } from '../infrastructure/rule.repository';
import { SuggestionRepository } from '../infrastructure/suggestion.repository';
import { aggregateConfidence, matchSupplier, suggestAccount, suggestVat } from '../domain/rules/rules-engine';
import { DocIntelEvents } from '../events';
import type { AccountingSuggestion, CounterpartyRef, PostingLine } from '../domain/rules/models';
import type { CreateRuleInput, IRulesEngineService } from './rules-engine.service.interface';

class RulesError extends Error {}
const DEFAULT_EXPENSE_ACCOUNT = '602'; // External Services (BG plan) — MVP default

@Injectable()
export class RulesEngineService implements IRulesEngineService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly rules: RuleRepository,
    private readonly suggestions: SuggestionRepository,
    @Inject(EXTRACTION_SERVICE) private readonly extraction: IExtractionService,
    @Inject(MASTERDATA_SERVICE) private readonly masterdata: IMasterDataService,
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
    const field = (k: string): string | undefined => pkg.fields.find((f) => f.key === k)?.valueText;

    const counterpartiesPage = await this.masterdata.listCounterparties({ pageSize: 200 });
    const counterparties: CounterpartyRef[] = counterpartiesPage.items.map((c) => ({ id: c.id, name: c.name, eik: c.eik, vatNumber: c.vatNumber, countryCode: c.countryCode }));
    const vatCodes = (await this.masterdata.listVatCodes(true)).map((v) => ({ id: v.id, code: v.code, kind: v.kind }));
    const settings = await this.masterdata.getCompanySettings();
    const countries = await this.masterdata.listCountries();

    const match = matchSupplier({ eik: field('supplier_eik'), vat: field('supplier_vat'), name: field('supplier_name') }, counterparties);
    const supplierCountry = match.counterparty?.countryCode ?? 'BG';
    const supplierIsEu = countries.find((c) => c.code === supplierCountry)?.isEu ?? true;

    const result = await this.db.run(async (db) => {
      const activeRules = await this.rules.listActive(db, 'supplier_account');
      const history = match.counterparty ? await this.suggestions.supplierHistory(db, match.counterparty.id) : null;
      const account = suggestAccount({ match, rules: activeRules, history: history ?? undefined, defaultAccountCode: DEFAULT_EXPENSE_ACCOUNT });
      const vat = suggestVat({ companyVatRegistered: settings?.vatRegistered ?? false, supplierCountry, supplierIsEu, net: field('net_amount'), vat: field('vat_amount'), vatCodes });

      // proposed posting (NOT a journal entry): Dr expense (+ Dr VAT input) / Cr payables
      const net = field('net_amount'); const vatAmt = field('vat_amount'); const total = field('total_amount');
      const posting: PostingLine[] = [];
      if (net) posting.push({ accountCode: account.accountCode, side: 'debit', amount: net });
      if (vatAmt && vat.treatment !== 'none') posting.push({ accountCode: '4531', side: 'debit', amount: vatAmt }); // VAT input (BG plan)
      if (total) posting.push({ accountCode: '401', side: 'credit', amount: total }); // suppliers/payables

      const invoiceNumber = field('invoice_number');
      const duplicateOf = invoiceNumber ? await this.suggestions.findDuplicateByInvoiceNumber(db, invoiceNumber, documentId) : null;
      const accountId = await this.suggestions.accountIdByCode(db, account.accountCode);

      const confidence = aggregateConfidence({ extractionOverall: pkg.overallConfidence, matchConfidence: match.confidence, accountConfidence: account.confidence, vatConfidence: vat.confidence });
      const explanation = [account.explanation, vat.explanation, match.basis === 'none' ? 'Supplier not matched to an existing counterparty.' : `Supplier matched by ${match.basis}.`, duplicateOf ? 'Possible duplicate invoice number detected.' : ''].filter(Boolean).join(' ');

      const id = await this.suggestions.save(db, tenantId, companyId, {
        documentId, extractionId: pkg.extractionId, counterpartyId: match.counterparty?.id, suggestedAccountId: accountId ?? undefined,
        posting, confidence, explanation, isDuplicate: !!duplicateOf, duplicateOf: duplicateOf ?? undefined,
        vat: { treatment: vat.treatment, rate: vat.rate, vatCodeId: vat.codeId ?? undefined, confidence: vat.confidence, explanation: vat.explanation },
      });
      // audited as the AI actor — proposes only, never posts (Invariant 4)
      await this.audit.append(db, { companyId, actorType: 'ai', action: DocIntelEvents.SuggestionReady, entityType: 'accounting_suggestion', entityId: id, after: { account: account.accountCode, vat: vat.treatment, confidence, isDuplicate: !!duplicateOf } });
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

  async createRule(input: CreateRuleInput): Promise<{ ruleId: string }> {
    const { tenantId, companyId } = this.scope();
    return this.db.run(async (db) => {
      const ruleId = await this.rules.createRule(db, tenantId, companyId, { ruleType: input.ruleType, name: input.name, matchKey: input.matchKey });
      await this.rules.addVersion(db, tenantId, companyId, ruleId, { match: { matchKey: input.matchKey }, action: { accountCode: input.accountCode, vatCode: input.vatCode, confidence: input.confidence ?? 0.9 } });
      return { ruleId };
    });
  }
}
