import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { MASTERDATA_SERVICE, type IMasterDataService } from '../../masterdata';
import { SaftRepository } from '../infrastructure/saft.repository';
import { buildHeader, monthBounds, purchaseAmounts } from '../domain/assemble';
import type { SaftDataset, SaftPurchaseDocument } from '../domain/models';
import type { ISaftDatasetBuilder } from './saft-dataset.builder.interface';

@Injectable()
export class SaftDatasetBuilder implements ISaftDatasetBuilder {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: SaftRepository,
    @Inject(MASTERDATA_SERVICE) private readonly masterdata: IMasterDataService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new BadRequestException('No active company selected.');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }

  async buildDataset(year: number, month: number): Promise<SaftDataset> {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new BadRequestException('A valid year and month (1–12) are required.');
    const { companyId } = this.scope();
    const { from, to } = monthBounds(year, month);
    // Account codes for purchase amount derivation — from the configurable mapping (not hardcoded).
    const accts = await this.masterdata.getPostingAccounts();
    const generatedAt = new Date().toISOString();

    return this.db.run(async (db) => {
      const company = await this.repo.companyInfo(db, companyId);
      const customers = await this.repo.customers(db, companyId);
      const suppliers = await this.repo.suppliers(db, companyId);
      const products = await this.repo.products(db, companyId);
      const accounts = await this.repo.accounts(db, companyId);
      const taxCodes = await this.repo.taxCodes(db, companyId);
      const generalLedgerEntries = await this.repo.glEntries(db, companyId, from, to);
      const salesInvoices = await this.repo.salesInvoices(db, companyId, from, to);
      const purchaseRaw = await this.repo.purchaseEntries(db, companyId, from, to);
      const payments = await this.repo.payments(db, companyId, from, to);

      const purchaseDocuments: SaftPurchaseDocument[] = purchaseRaw.map((p) => {
        const amounts = purchaseAmounts(p.lines, accts.payable, accts.purchase_vat_input);
        return {
          supplier: p.supplier, supplierId: p.supplierId, documentNumber: `#${p.entryNo}`, documentDate: p.postingDate,
          netAmount: amounts.net, vatAmount: amounts.vat, grossAmount: amounts.gross,
          classificationCategory: p.classificationCategory, accountingSuggestion: p.accountingSuggestion,
          approvalStatus: p.approvalStatus, journalEntryId: p.journalEntryId,
        };
      });

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
    });
  }
}
