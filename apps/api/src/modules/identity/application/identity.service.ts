import { Injectable } from '@nestjs/common';
import type { IIdentityService } from './identity.service.interface';

/**
 * Skeleton provider for Identity. No business logic — operations are implemented per feature task.
 * Kept private to the module (not re-exported from the public index).
 */
@Injectable()
export class IdentityService implements IIdentityService {}
