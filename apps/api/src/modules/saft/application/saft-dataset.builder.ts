import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { MASTERDATA_SERVICE, type IMasterDataService } from '../../masterdata';
import { POSTING_SERVICE, type IPostingService } from '../../docintel';
import { SaftRepository } from '../infrastructure/saft.repository';
import { buildHeader, monthBounds, purchaseAmounts } from '../domain/assemble';
import type { SaftDataset, SaftGlEntry, SaftPurchaseDocument } from '../domain/models';
import type { ISaftDatasetBuilder } from './saft-dataset.builder.interface';

@Injectable()
export class SaftDatasetBuilder implements ISaftDatasetBuilder {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: SaftRepository,
    @Inject(MASTERDATA_SERVICE) private readonly masterdata: IMasterDataService,
    @Inject(POSTING_SERVICE) private readonly postings: IPostingService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new BadRequestException('No active company selected.');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }

  /** A purchase source document is a non-reversal entry posted from an approved review. */
  private isPurchaseEntry(e: SaftGlEntry): boolean {
    return e.sourceType === 'review' && !e.reversesEntryId && !!e.sourceId;
  }

  async buildDataset(year: number, month: number): Promise<SaftDataset> {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new BadRequestException('A valid year and month (1–12) are required.');
    const { companyId } = this.scope();
    const { from, to } = monthBounds(year, month);
    // Account codes for purchase amount derivation — from the configurable mapping (not hardcoded).
    const accts = await this.masterdata.getPostingAccounts();
    const generatedAt = new Date().toISOString();

    // All direct reads run in ONE transaction (consistent snapshot).
    const reads = await this.db.run(async (db) => ({
      company: await this.repo.companyInfo(db, companyId),
      customers: await this.repo.customers(db, companyId),
      suppliers: await this.repo.suppliers(db, companyId),
      products: await this.repo.products(db, companyId),
      accounts: await this.repo.accounts(db, companyId),
      taxCodes: await this.repo.taxCodes(db, companyId),
      generalLedgerEntries: await this.repo.glEntries(db, companyId, from, to),
      salesInvoices: await this.repo.salesInvoices(db, companyId, from, to),
      payments: await this.repo.payments(db, companyId, from, to),
    }));

    // Purchases are derived from the GL entries already loaded; enrichment (supplier,
    // category, approval status) comes from the docintel read-model in ONE batched call
    // — no direct access to another context's tables, and no per-entry query.
    const purchaseEntries = reads.generalLedgerEntries.filter((e) => this.isPurchaseEntry(e));
    const details = purchaseEntries.length > 0
      ? await this.postings.listPostedPurchaseDetails(purchaseEntries.map((e) => e.sourceId as string))
      : [];
    const detailByReview = new Map(details.map((d) => [d.reviewPackageId, d]));

    const purchaseDocuments: SaftPurchaseDocument[] = purchaseEntries.map((e) => {
      const amounts = purchaseAmounts(e.lines, accts.payable, accts.purchase_vat_input);
      const d = detailByReview.get(e.sourceId as string);
      return {
        supplier: d?.supplierName, supplierId: d?.supplierId, documentNumber: `#${e.entryNo}`, documentDate: e.postingDate,
        netAmount: amounts.net, vatAmount: amounts.vat, grossAmount: amounts.gross,
        classificationCategory: d?.classificationCategory, accountingSuggestion: d?.accountingSuggestion,
        approvalStatus: d?.approvalStatus, journalEntryId: e.journalEntryId,
      };
    });

    const { company, customers, suppliers, products, accounts, taxCodes, generalLedgerEntries, salesInvoices, payments } = reads;
    return {
      header: buildHeader({ companyName: company.name, eik: company.eik, vatNumber: company.vatNumber, currency: company.currency, year, month, generatedAt }),
      masterFiles: { customers, suppliers, products, accounts, taxCodes },
      generalLedgerEntries,
      sourceDocuments: { salesInvoices, purchaseDocuments, payments },
      counts: {
        customers: customers.length, suppliers: suppliers.length, products: products.length, accounts: accounts.length, taxCodes: taxCodes.length,
        glEntries: generalLedgerEntries.length, salesInvoices: salesInvoices.length, purchaseDocuments: purchaseDocuments.length, payments: payments.length,
      },
    };
  }
}
