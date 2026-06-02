import { Injectable } from '@nestjs/common';
import type { IDocIntelService } from './docintel.service.interface';

/**
 * Skeleton provider for DocIntel. No business logic — operations are implemented per feature task.
 * Kept private to the module (not re-exported from the public index).
 */
@Injectable()
export class DocIntelService implements IDocIntelService {}
