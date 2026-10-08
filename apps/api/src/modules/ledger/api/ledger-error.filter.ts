import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { AlreadyReversedError, SettlementReversalNotAllowedError } from '../domain/errors';

/**
 * Narrow mapping for the EXPECTED accounting conflicts of the reversal endpoint only:
 * the entry is already reversed (incl. the loser of a concurrent reversal race), or it is a
 * payment settlement that must be reversed via the payment workflow. Both are 409 with a
 * user-safe message. Every other error is NOT caught here and keeps its existing handling
 * (unexpected errors stay 500; raw PostgreSQL errors are never echoed).
 */
@Catch(AlreadyReversedError, SettlementReversalNotAllowedError)
export class LedgerConflictFilter implements ExceptionFilter {
  catch(err: AlreadyReversedError | SettlementReversalNotAllowedError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(HttpStatus.CONFLICT).json({ statusCode: HttpStatus.CONFLICT, error: err.name, message: err.message });
  }
}
