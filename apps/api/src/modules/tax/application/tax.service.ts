import { Injectable } from '@nestjs/common';
import type { ITaxService } from './tax.service.interface';

/**
 * Skeleton provider for Tax. No business logic — operations are implemented per feature task.
 * Kept private to the module (not re-exported from the public index).
 */
@Injectable()
export class TaxService implements ITaxService {}
