import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { LedgerModule } from '../ledger';
import { TaxModule } from '../tax';
import { InvoicingController } from './api/invoicing.controller';
import { InvoicesController } from './api/invoices.controller';
import { INVOICING_SERVICE } from './application/invoicing.service.interface';
import { InvoicingService } from './application/invoicing.service';
import { INVOICE_SERVICE } from './application/invoice.service.interface';
import { InvoiceService } from './application/invoice.service';
import { INVOICE_PDF_GENERATOR } from './application/pdf.port';
import { INVOICE_EMAIL_SENDER } from './application/email.port';
import { InvoiceRepository } from './infrastructure/invoice.repository';
import { PdfLibInvoiceGenerator } from './infrastructure/pdf-lib-invoice-generator';
import { SmtpEmailSender } from './infrastructure/smtp-email-sender';
import { ResendEmailSender } from './infrastructure/resend-email-sender';
import { DocIntelModule } from '../docintel';
import { LogEmailSender } from './infrastructure/log-email-sender';

/**
 * Invoicing bounded context. Public surface: INVOICE_SERVICE (+ legacy INVOICING_SERVICE).
 * On issue, posts Dr 411 / Cr 702 / Cr 4532 to the immutable ledger and feeds the sales VAT
 * register. Issue/send/post are HUMAN-only — AI cannot issue, send, or post invoices.
 */
@Module({
  imports: [AuditModule, LedgerModule, TaxModule, DocIntelModule],
  controllers: [InvoicingController, InvoicesController],
  providers: [
    { provide: INVOICING_SERVICE, useClass: InvoicingService },
    { provide: INVOICE_SERVICE, useClass: InvoiceService },
    { provide: INVOICE_PDF_GENERATOR, useClass: PdfLibInvoiceGenerator },
    { provide: INVOICE_EMAIL_SENDER, useClass: process.env.RESEND_API_KEY ? ResendEmailSender : (process.env.SMTP_HOST ? SmtpEmailSender : LogEmailSender) },
    InvoiceRepository,
  ],
  exports: [INVOICING_SERVICE, INVOICE_SERVICE],
})
export class InvoicingModule {}
