import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { INVOICE_SERVICE, type IInvoiceService } from '../application/invoice.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { CreateInvoiceDto, SendEmailDto } from './dto/invoices.dto';
import type { InvoiceStatus } from '../domain/invoice/models';

/** Sales invoice endpoints. Issue/send require human-only invoice permissions (guarded globally + at the service). */
@Controller('invoices')
export class InvoicesController {
  constructor(@Inject(INVOICE_SERVICE) private readonly invoices: IInvoiceService) {}

  @Post() @RequirePermission(PERMISSIONS.INVOICE_CREATE)
  create(@Body() dto: CreateInvoiceDto) { return this.invoices.createDraft(dto); }

  @Get() @RequirePermission(PERMISSIONS.INVOICE_READ)
  list(@Query('status') status?: InvoiceStatus, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.invoices.listInvoices(status, page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined);
  }

  @Get(':id') @RequirePermission(PERMISSIONS.INVOICE_READ)
  get(@Param('id') id: string) { return this.invoices.getInvoice(id); }

  @Get(':id/validate') @RequirePermission(PERMISSIONS.INVOICE_READ)
  validate(@Param('id') id: string) { return this.invoices.validateInvoice(id); }

  @Post(':id/issue') @RequirePermission(PERMISSIONS.INVOICE_ISSUE)
  issue(@Param('id') id: string) { return this.invoices.issueInvoice(id); }

  @Post(':id/create-credit-note') @RequirePermission(PERMISSIONS.INVOICE_CREATE)
  createCreditNote(@Param('id') id: string) { return this.invoices.createCreditNote(id); }

  @Post(':id/create-debit-note') @RequirePermission(PERMISSIONS.INVOICE_CREATE)
  createDebitNote(@Param('id') id: string) { return this.invoices.createDebitNote(id); }

  @Post(':id/convert-to-invoice') @RequirePermission(PERMISSIONS.INVOICE_CREATE)
  convertToInvoice(@Param('id') id: string) { return this.invoices.convertProformaToInvoice(id); }

  @Get(':id/related-documents') @RequirePermission(PERMISSIONS.INVOICE_READ)
  relatedDocuments(@Param('id') id: string) { return this.invoices.getRelatedDocuments(id); }

  @Post(':id/email') @RequirePermission(PERMISSIONS.INVOICE_SEND)
  email(@Param('id') id: string, @Body() dto: SendEmailDto) { return this.invoices.sendInvoiceEmail(id, dto.toEmail); }

  @Get(':id/email') @RequirePermission(PERMISSIONS.INVOICE_READ)
  deliveries(@Param('id') id: string) { return this.invoices.listEmailDeliveries(id); }
}
