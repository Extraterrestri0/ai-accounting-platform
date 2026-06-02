import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { LEDGER_SERVICE, type ILedgerService, type PostEntryInput } from '../../ledger';
import { VAT_SERVICE, type IVatService } from '../../tax';
import { InvoiceRepository } from '../infrastructure/invoice.repository';
import { INVOICE_PDF_GENERATOR, type InvoicePdfGenerator } from './pdf.port';
import { INVOICE_EMAIL_SENDER, type InvoiceEmailSender } from './email.port';
import { computeLine, computeTotals, formatInvoiceNumber, validateForIssue, InvoiceValidationError } from '../domain/invoice/calculator';
import type { CreateDraftInput, EmailDelivery, Invoice } from '../domain/invoice/models';
import type { IInvoiceService, IssueResult } from './invoice.service.interface';

class InvoiceError extends Error {}
const REVENUE_ACCOUNT = '702';   // Sales revenue (BG plan)
const VAT_OUTPUT_ACCOUNT = '4532';
const RECEIVABLE_ACCOUNT = '411'; // Customers

@Injectable()
export class InvoiceService implements IInvoiceService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: InvoiceRepository,
    @Inject(LEDGER_SERVICE) private readonly ledger: ILedgerService,
    @Inject(VAT_SERVICE) private readonly vat: IVatService,
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
    const { tenantId, companyId } = this.scope();
    const id = await this.db.run(async (db) => {
      const invoiceId = await this.repo.createDraft(db, tenantId, companyId, { customerId: input.customerId, customerName: input.customerName, seriesCode: input.seriesCode ?? 'A', currency: input.currency ?? 'EUR', dueDate: input.dueDate, notes: input.notes });
      let lineNo = 1; const computed: { netAmount: string; vatAmount: string }[] = [];
      for (const l of input.lines) {
        const { net, vat, gross } = computeLine(l);
        await this.repo.insertLine(db, tenantId, companyId, invoiceId, lineNo++, { ...l, net, vat, gross });
        computed.push({ netAmount: net, vatAmount: vat });
      }
      const totals = computeTotals(computed);
      await this.repo.setTotals(db, invoiceId, totals.net, totals.vat, totals.gross);
      return invoiceId;
    });
    const created = await this.getInvoice(id);
    return created!;
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

    // 1) Validate + allocate gapless number + flip draft→issued (single txn).
    const issued = await this.db.run(async (db) => {
      const inv = await this.repo.get(db, invoiceId);
      if (!inv) throw new InvoiceError(`Invoice ${invoiceId} not found.`);
      if (inv.status !== 'draft') throw new InvoiceError(`Invoice ${invoiceId} is not a draft (status ${inv.status}).`);
      validateForIssue({ customerId: inv.customerId, customerName: inv.customerName, lines: inv.lines });
      const year = new Date().getFullYear();
      const n = await this.repo.allocateNumber(db, tenantId, companyId, inv.seriesCode, year, `${year}-`);
      const number = formatInvoiceNumber(`${year}-`, n);
      await this.repo.markIssued(db, invoiceId, number, year, userId);
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'invoicing.invoice_issued', entityType: 'invoice', entityId: invoiceId, after: { number, gross: inv.grossTotal } });
      return { ...inv, status: 'issued' as const, invoiceNumber: number, seriesYear: year };
    });

    // 2) Generate the PDF artifact (idempotent enough for MVP).
    const pdf = await this.pdf.generate(issued);
    await this.db.run((db) => this.repo.addPdf(db, tenantId, companyId, invoiceId, pdf.storageKey, pdf.checksum));

    // 3) Post to the ledger: Dr 411 / Cr 702 / Cr 4532 (ledger's own txn enforces balance + immutability + audit).
    let journalEntryId: string | undefined;
    try {
      const accId = await this.db.run(async (db) => ({
        rec: await this.repo.accountIdByCode(db, RECEIVABLE_ACCOUNT),
        rev: await this.repo.accountIdByCode(db, REVENUE_ACCOUNT),
        vat: await this.repo.accountIdByCode(db, VAT_OUTPUT_ACCOUNT),
      }));
      if (!accId.rec || !accId.rev) throw new InvoiceError('Sales accounts (411/702) are not configured.');
      const lines = [
        { accountId: accId.rec, direction: 'debit' as const, amount: issued.grossTotal },
        { accountId: accId.rev, direction: 'credit' as const, amount: issued.netTotal },
      ];
      if (Number(issued.vatTotal) > 0 && accId.vat) lines.push({ accountId: accId.vat, direction: 'credit' as const, amount: issued.vatTotal });
      const input: PostEntryInput = { postingDate: new Date().toISOString().slice(0, 10), description: `Invoice ${issued.invoiceNumber}`, sourceType: 'invoice', sourceRef: invoiceId, currency: issued.currency, lines };
      const entry = await this.ledger.postEntry(input);
      journalEntryId = entry.id;
      await this.db.run(async (db) => {
        await this.repo.linkJournalEntry(db, invoiceId, entry.id);
        await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'invoicing.invoice_posted', entityType: 'journal_entry', entityId: entry.id, after: { invoiceId, number: issued.invoiceNumber } });
      });
      // 4) Feed the sales VAT register for the period (idempotent build).
      const d = new Date();
      await this.vat.buildRegisters(d.getFullYear(), d.getMonth() + 1);
    } catch (e) {
      // The invoice is legally issued (number consumed); posting is retryable. Surface but don't roll back the number.
      throw new InvoiceError(`Invoice ${issued.invoiceNumber} issued but posting failed: ${(e as Error).message}`);
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
