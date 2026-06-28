import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Query, UseFilters } from '@nestjs/common';
import { PAYMENT_SERVICE, type IPaymentService } from '../application/payment.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import { PaymentsErrorFilter } from './payments-error.filter';
import type { RecordPaymentDto, ReversePaymentDto } from './dto/payments.dto';
import type { DocumentType } from '../domain/models';

const DOC_TYPES: DocumentType[] = ['sales_invoice', 'purchase_invoice'];

/** Payment endpoints. Recording/reversing post to the immutable ledger — human-only. */
@Controller('payments')
@UseFilters(PaymentsErrorFilter)
export class PaymentsController {
  constructor(@Inject(PAYMENT_SERVICE) private readonly payments: IPaymentService) {}

  @Post() @RequirePermission(PERMISSIONS.PAYMENT_RECORD)
  record(@Body() dto: RecordPaymentDto) {
    if (!dto || !DOC_TYPES.includes(dto.documentType)) throw new BadRequestException('documentType must be sales_invoice or purchase_invoice.');
    if (!dto.documentId) throw new BadRequestException('documentId is required.');
    if (dto.amount == null || Number(dto.amount) <= 0) throw new BadRequestException('A positive amount is required.');
    return this.payments.recordPayment({
      documentType: dto.documentType, documentId: dto.documentId, amount: dto.amount,
      paymentDate: dto.paymentDate, currency: dto.currency, reference: dto.reference, notes: dto.notes,
    });
  }

  @Post(':id/reverse') @RequirePermission(PERMISSIONS.PAYMENT_REVERSE)
  reverse(@Param('id') id: string, @Body() dto: ReversePaymentDto) {
    return this.payments.reversePayment(id, dto?.reason ?? '');
  }

  @Get() @RequirePermission(PERMISSIONS.PAYMENT_READ)
  list(
    @Query('documentType') documentType?: DocumentType,
    @Query('documentId') documentId?: string,
    @Query('counterpartyId') counterpartyId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const dt = documentType && DOC_TYPES.includes(documentType) ? documentType : undefined;
    return this.payments.listPayments({ documentType: dt, documentId, counterpartyId }, page ? Number(page) : 1, pageSize ? Number(pageSize) : 50);
  }

  @Get(':id') @RequirePermission(PERMISSIONS.PAYMENT_READ)
  get(@Param('id') id: string) { return this.payments.getPayment(id); }
}
