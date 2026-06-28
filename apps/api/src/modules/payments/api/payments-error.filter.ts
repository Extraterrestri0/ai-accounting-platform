import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import {
  AccountNotConfiguredError, AlreadyReversedError, DocumentNotFoundError, OverpaymentError,
  PaymentError, PaymentNotFoundError,
} from '../domain/errors';

/**
 * Translates pure (framework-free) Payments domain errors into user-safe HTTP
 * responses. Keeps the domain layer free of NestJS while still returning correct
 * 4xx status codes (the API never leaks internals).
 */
@Catch(PaymentError, OverpaymentError)
export class PaymentsErrorFilter implements ExceptionFilter {
  catch(err: PaymentError | OverpaymentError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const status =
      err instanceof DocumentNotFoundError || err instanceof PaymentNotFoundError ? HttpStatus.NOT_FOUND
      : err instanceof AlreadyReversedError ? HttpStatus.CONFLICT
      : err instanceof OverpaymentError ? HttpStatus.UNPROCESSABLE_ENTITY
      : err instanceof AccountNotConfiguredError ? HttpStatus.UNPROCESSABLE_ENTITY
      : HttpStatus.BAD_REQUEST;
    res.status(status).json({ statusCode: status, error: err.constructor.name, message: err.message });
  }
}
