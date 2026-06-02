import { Injectable } from '@nestjs/common';
import type { IReportingService } from './reporting.service.interface';

/**
 * Skeleton provider for Reporting. No business logic — operations are implemented per feature task.
 * Kept private to the module (not re-exported from the public index).
 */
@Injectable()
export class ReportingService implements IReportingService {}
