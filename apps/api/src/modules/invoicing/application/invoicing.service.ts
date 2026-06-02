import { Injectable } from '@nestjs/common';
import type { IInvoicingService } from './invoicing.service.interface';

/**
 * Skeleton provider for Invoicing. No business logic — operations are implemented per feature task.
 * Kept private to the module (not re-exported from the public index).
 */
@Injectable()
export class InvoicingService implements IInvoicingService {}
