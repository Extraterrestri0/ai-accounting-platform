import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

export class BankAccountNotFoundError extends NotFoundException {
  constructor(id: string) { super(`Bank account ${id} was not found.`); }
}
export class BankTransactionNotFoundError extends NotFoundException {
  constructor(id: string) { super(`Bank transaction ${id} was not found.`); }
}
export class UnsupportedFormatError extends BadRequestException {
  constructor(format: string) { super(`Unsupported statement format "${format}". Supported: csv, xlsx.`); }
}
export class EmptyStatementError extends BadRequestException {
  constructor() { super('The statement contains no data rows.'); }
}
export class AlreadyReconciledError extends ConflictException {
  constructor(id: string) { super(`Bank transaction ${id} is already reconciled.`); }
}
export class DirectionMismatchError extends BadRequestException {
  constructor() { super('Inbound transactions reconcile against receivables; outbound against payables.'); }
}
