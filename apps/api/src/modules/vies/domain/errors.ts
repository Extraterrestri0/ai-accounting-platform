import { BadRequestException, NotFoundException } from '@nestjs/common';

/** The supplied VAT number is empty or not an EU-format number. */
export class InvalidVatNumberError extends BadRequestException {
  constructor(vat: string) { super(`'${vat || '(empty)'}' is not a valid EU VAT number.`); }
}

/** The counterparty does not exist or has no VAT number to validate. */
export class CounterpartyVatMissingError extends NotFoundException {
  constructor(id: string) { super(`Counterparty ${id} was not found or has no VAT number.`); }
}
