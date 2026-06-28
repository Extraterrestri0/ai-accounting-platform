import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { LEDGER_SERVICE, type ILedgerService, type PostEntryInput } from '../../ledger';
import { VAT_SERVICE, type IVatService } from '../../tax';
import { PERIOD_SERVICE, type IAccountingPeriodService } from '../../periods';
import { MASTERDATA_SERVICE, type IMasterDataService, type CatalogItem } from '../../masterdata';
import { InvoiceRepository } from '../infrastructure/invoice.repository';
import { INVOICE_PDF_GENERATOR, type InvoicePdfGenerator } from './pdf.port';
import { INVOICE_EMAIL_SENDER, type InvoiceEmailSender } from './email.port';
import { buildPostingPlan, computeLine, computeTotals, formatInvoiceNumber, numberPrefixFor, validateForIssue, InvoiceValidationError } from '../domain/invoice/calculator';
import type { CreateDraftInput, DocumentKind, EmailDelivery, Invoice, RelatedDocument } from '../domain/invoice/models';
import type { IInvoiceService, IssueResult, RelatedDocuments } from './invoice.service.interface';

class InvoiceError extends Error {}

const toRelated = (inv: Invoice, relation: RelatedDocument['relation']): RelatedDocument => ({
  id: inv.id, documentKind: inv.documentKind, status: inv.status, invoiceNumber: inv.invoiceNumber,
  grossTotal: inv.grossTotal, createdAt: inv.createdAt, relation,
});

@Injectable()
export class InvoiceService implements IInvoiceService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: InvoiceRepository,
    @Inject(LEDGER_SERVICE) private readonly ledger: ILedgerService,
    @Inject(VAT_SERVICE) private readonly vat: IVatService,
    @Inject(PERIOD_SERVICE) private readonly periods: IAccountingPeriodService,
    @Inject(MASTERDATA_SERVICE) private readonly masterdata: IMasterDataService,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
    @Inject(INVOICE_PDF_GENERATOR) private readonly pdf: InvoicePdfGenerator,
    @Inject(INVOICE_EMAIL_SENDER) private readonly email: InvoiceEmailSender,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new InvoiceError('No active company in context.');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }
  /** Issuing / posting / sending are human actions. AI/worker identities are refused (Invariant 4/5). */
  private requireHuman(): string {
    const { userId } = this.scope();
    if (!userId) throw new ForbiddenException('This action requires a human (AI cannot issue, post, or send invoices).');
    return userId;
  }

  async createDraft(input: CreateDraftInput): Promise<Invoice> {
    const { tenantId, companyId, userId } = this.scope();
    const documentKind: DocumentKind = input.documentKind ?? 'invoice';
    // Pre-resolve any catalog items referenced by the lines (free-text lines have none).
    // A line links to a catalog item; description/VAT/unit/SAF-T default from the item but
    // remain overridable per line. A missing item is treated as free text (graceful).
    const catalogIds = [...new Set(input.lines.map((l) => l.catalogItemId).filter((x): x is string => !!x))];
    const catalog = new Map<string, CatalogItem>();
    for (const cid of catalogIds) { try { catalog.set(cid, await this.masterdata.getCatalogItem(cid)); } catch { /* not found → free text */ } }

    const id = await this.db.run(async (db) => {
      const invoiceId = await this.repo.createDraft(db, tenantId, companyId, { documentKind, referencesInvoiceId: input.referencesInvoiceId, customerId: input.customerId, customerName: input.customerName, seriesCode: input.seriesCode ?? 'A', currency: input.currency ?? 'EUR', dueDate: input.dueDate, notes: input.notes });
      let lineNo = 1; const computed: { netAmount: string; vatAmount: string }[] = [];
      for (const l of input.lines) {
        const ci = l.catalogItemId ? catalog.get(l.catalogItemId) : undefined;
        const description = (l.description?.trim()) || ci?.description || '';
        const vatRate = (l.vatRate ?? '').toString().trim() || ci?.vatRate || '0';
        const vatCodeId = l.vatCodeId ?? ci?.vatCodeId;
        const eff = { description, quantity: l.quantity, unitPrice: l.unitPrice, vatCodeId, vatRate };
        const { net, vat, gross } = computeLine(eff);
        await this.repo.insertLine(db, tenantId, companyId, invoiceId, lineNo++, { ...eff, catalogItemId: ci?.id, unit: ci?.unit, saftCode: ci?.saftCode, net, vat, gross });
        computed.push({ netAmount: net, vatAmount: vat });
      }
      const totals = computeTotals(computed);
      await this.repo.setTotals(db, invoiceId, totals.net, totals.vat, totals.gross);
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'invoicing.document_created', entityType: 'invoice', entityId: invoiceId, after: { documentKind, referencesInvoiceId: input.referencesInvoiceId, gross: totals.gross } });
      return invoiceId;
    });
    const created = await this.getInvoice(id);
    return created!;
  }

  /** Create a credit note (reverses) or debit note (increases) from an ISSUED invoice/debit note. */
  createCreditNote(invoiceId: string): Promise<Invoice> { return this.createNoteFrom(invoiceId, 'credit_note'); }
  createDebitNote(invoiceId: string): Promise<Invoice> { return this.createNoteFrom(invoiceId, 'debit_note'); }

  private async createNoteFrom(invoiceId: string, kind: 'credit_note' | 'debit_note'): Promise<Invoice> {
    this.scope();
    const src = await this.getInvoice(invoiceId);
    if (!src) throw new InvoiceError('Source document not found.');
    if (src.status !== 'issued') throw new InvoiceError('A credit/debit note can only be created from an ISSUED document.');
    if (src.documentKind !== 'invoice' && src.documentKind !== 'debit_note') {
      throw new InvoiceError(`Cannot create a ${kind === 'credit_note' ? 'credit' : 'debit'} note from a ${src.documentKind}.`);
    }
    // copy the source lines into a new draft (the user can adjust quantities for a partial note)
    return this.createDraft({
      documentKind: kind, referencesInvoiceId: src.id,
      customerId: src.customerId, customerName: src.customerName, currency: src.currency,
      lines: src.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, vatCodeId: l.vatCodeId, vatRate: l.vatRate, catalogItemId: l.catalogItemId })),
    });
  }

  /** Create an invoice DRAFT from a proforma (the user then issues it normally). */
  async convertProformaToInvoice(proformaId: string): Promise<Invoice> {
    const { companyId, userId } = this.scope();
    const src = await this.getInvoice(proformaId);
    if (!src) throw new InvoiceError('Proforma not found.');
    if (src.documentKind !== 'proforma') throw new InvoiceError('Only a proforma can be converted to an invoice.');
    const draft = await this.createDraft({
      documentKind: 'invoice', referencesInvoiceId: src.id,
      customerId: src.customerId, customerName: src.customerName, currency: src.currency,
      lines: src.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, vatCodeId: l.vatCodeId, vatRate: l.vatRate, catalogItemId: l.catalogItemId })),
    });
    await this.db.run((db) => this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'invoicing.proforma_converted', entityType: 'invoice', entityId: draft.id, after: { fromProforma: src.id, fromNumber: src.invoiceNumber } }));
    return draft;
  }

  /** The document plus its source and any documents derived from it. */
  async getRelatedDocuments(invoiceId: string): Promise<RelatedDocuments> {
    this.scope();
    return this.db.run(async (db) => {
      const self = await this.repo.get(db, invoiceId);
      if (!self) throw new InvoiceError('Document not found.');
      const related: RelatedDocument[] = [];
      if (self.referencesInvoiceId) {
        const source = await this.repo.get(db, self.referencesInvoiceId);
        if (source) related.push(toRelated(source, 'source'));
      }
      for (const d of await this.repo.listReferencing(db, invoiceId)) related.push(toRelated(d, 'derived'));
      return { document: toRelated(self, 'self'), related };
    });
  }

  getInvoice(invoiceId: string): Promise<Invoice | null> { this.scope(); return this.db.run((db) => this.repo.get(db, invoiceId)); }
  listInvoices(status?: 'draft' | 'issued', page = 1, pageSize = 25): Promise<Invoice[]> {
    this.scope(); const size = Math.min(100, Math.max(1, pageSize));
    return this.db.run((db) => this.repo.list(db, status, size, (Math.max(1, page) - 1) * size));
  }

  async validateInvoice(invoiceId: string): Promise<{ ok: boolean; errors: string[] }> {
    this.scope();
    const inv = await this.getInvoice(invoiceId);
    if (!inv) throw new InvoiceError(`Invoice ${invoiceId} not found.`);
    try { validateForIssue({ customerId: inv.customerId, customerName: inv.customerName, lines: inv.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, vatRate: l.vatRate })) }); return { ok: true, errors: [] }; }
    catch (e) { return { ok: false, errors: [(e as Error).message] }; }
  }

  async issueInvoice(invoiceId: string): Promise<IssueResult> {
    const { tenantId, companyId } = this.scope();
    const userId = this.requireHuman();

    // Compliance gate (Task 4.3), checked BEFORE consuming a gapless number: an
    // invoice posts at today's date, so refuse issuance into a locked period.
    await this.periods.assertOpen(new Date().toISOString().slice(0, 10), 'Invoice issuance');

    // 1) Validate + allocate gapless number (PER document kind) + flip draft→issued (single txn).
    const issued = await this.db.run(async (db) => {
      const inv = await this.repo.get(db, invoiceId);
      if (!inv) throw new InvoiceError(`Document ${invoiceId} not found.`);
      if (inv.status !== 'draft') throw new InvoiceError(`Document ${invoiceId} is not a draft (status ${inv.status}).`);
      validateForIssue({ customerId: inv.customerId, customerName: inv.customerName, lines: inv.lines });
      const year = new Date().getFullYear();
      const prefix = numberPrefixFor(inv.documentKind, year);
      const n = await this.repo.allocateNumber(db, tenantId, companyId, inv.documentKind, inv.seriesCode, year, prefix);
      const number = formatInvoiceNumber(prefix, n);
      await this.repo.markIssued(db, invoiceId, number, year, userId);
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: `invoicing.${inv.documentKind}_issued`, entityType: 'invoice', entityId: invoiceId, after: { documentKind: inv.documentKind, number, gross: inv.grossTotal } });
      return { ...inv, status: 'issued' as const, invoiceNumber: number, seriesYear: year };
    });

    // 2) Generate the PDF artifact (idempotent enough for MVP). All kinds get a PDF.
    const pdf = await this.pdf.generate(issued);
    await this.db.run((db) => this.repo.addPdf(db, tenantId, companyId, invoiceId, pdf.storageKey, pdf.checksum));

    // 3) Posting — KIND-AWARE. Proforma posts NOTHING (no journal entry, no VAT).
    //    invoice/debit_note increase, credit_note reverses (see buildPostingPlan).
    const plan = buildPostingPlan(issued.documentKind, { net: issued.netTotal, vat: issued.vatTotal, gross: issued.grossTotal });
    if (!plan) {
      const fresh = await this.getInvoice(invoiceId);
      return { invoice: fresh!, journalEntryId: undefined };  // proforma: no accounting / no VAT
    }
    let journalEntryId: string | undefined;
    try {
      const accts = await this.masterdata.getPostingAccounts();
      const ids = await this.db.run(async (db) => ({
        receivable: await this.repo.accountIdByCode(db, accts.receivable),
        revenue: await this.repo.accountIdByCode(db, accts.sales_revenue),
        vatOutput: await this.repo.accountIdByCode(db, accts.sales_vat_output),
      }));
      const lines = plan.map((p) => {
        const accountId = ids[p.role];
        if (!accountId) throw new InvoiceError(`The ${p.role} account is not configured for this company.`);
        return { accountId, direction: p.direction, amount: p.amount };
      });
      const label = issued.documentKind === 'credit_note' ? 'Credit note' : issued.documentKind === 'debit_note' ? 'Debit note' : 'Invoice';
      const input: PostEntryInput = { postingDate: new Date().toISOString().slice(0, 10), description: `${label} ${issued.invoiceNumber}`, sourceType: 'invoice', sourceRef: invoiceId, currency: issued.currency, lines };
      const entry = await this.ledger.postEntry(input);
      journalEntryId = entry.id;
      await this.db.run(async (db) => {
        await this.repo.linkJournalEntry(db, invoiceId, entry.id);
        await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'invoicing.document_posted', entityType: 'journal_entry', entityId: entry.id, after: { invoiceId, documentKind: issued.documentKind, number: issued.invoiceNumber } });
      });
      // 4) Feed the sales VAT register (credit notes reduce, debit notes increase — signed classifier).
      const d = new Date();
      await this.vat.buildRegisters(d.getFullYear(), d.getMonth() + 1);
    } catch (e) {
      // The document is legally issued (number consumed); posting is retryable. Surface but don't roll back the number.
      throw new InvoiceError(`${issued.documentKind} ${issued.invoiceNumber} issued but posting failed: ${(e as Error).message}`);
    }

    const fresh = await this.getInvoice(invoiceId);
    return { invoice: fresh!, journalEntryId };
  }

  async sendInvoiceEmail(invoiceId: string, toEmail: string): Promise<EmailDelivery> {
    const { tenantId, companyId } = this.scope();
    this.requireHuman();
    const inv = await this.getInvoice(invoiceId);
    if (!inv) throw new InvoiceError(`Invoice ${invoiceId} not found.`);
    if (inv.status !== 'issued') throw new InvoiceError('Only issued invoices can be emailed.');
    const deliveryId = await this.db.run(async (db) => {
      const pdf = await this.repo.latestPdf(db, invoiceId);
      const id = await this.repo.queueEmail(db, tenantId, companyId, invoiceId, toEmail);
      return { id, pdfKey: pdf?.storageKey ?? `invoices/${invoiceId}.pdf` };
    });
    const result = await this.email.send({ to: toEmail, subject: `Invoice ${inv.invoiceNumber}`, pdfStorageKey: deliveryId.pdfKey });
    await this.db.run((db) => this.repo.updateEmail(db, deliveryId.id, result.status, result.providerMessageId, result.error));
    const all = await this.db.run((db) => this.repo.listEmails(db, invoiceId));
    return all.find((d) => d.id === deliveryId.id)!;
  }

  listEmailDeliveries(invoiceId: string): Promise<EmailDelivery[]> { this.scope(); return this.db.run((db) => this.repo.listEmails(db, invoiceId)); }
}
void InvoiceValidationError;
