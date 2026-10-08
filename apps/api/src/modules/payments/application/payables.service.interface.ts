import type { ApplicationService } from '../../../shared-kernel';
import type { AgingReport, ArApSummary, OpenItem } from '../domain/models';

/** PUBLIC read-model for Accounts Payable (unpaid supplier/purchase documents). */
export interface IPayablesService extends ApplicationService {
  getPayables(asOf?: string): Promise<OpenItem[]>;
  getPayablesSummary(asOf?: string): Promise<ArApSummary>;
  getPayablesAging(asOf?: string): Promise<AgingReport>;
}
export const PAYABLES_SERVICE = Symbol('Payments.PayablesService');
