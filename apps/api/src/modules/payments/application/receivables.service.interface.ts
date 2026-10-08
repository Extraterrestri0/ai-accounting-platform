import type { ApplicationService } from '../../../shared-kernel';
import type { AgingReport, ArApSummary, OpenItem } from '../domain/models';

/** PUBLIC read-model for Accounts Receivable (unpaid customer invoices). */
export interface IReceivablesService extends ApplicationService {
  getReceivables(asOf?: string): Promise<OpenItem[]>;
  getReceivablesSummary(asOf?: string): Promise<ArApSummary>;
  getReceivablesAging(asOf?: string): Promise<AgingReport>;
}
export const RECEIVABLES_SERVICE = Symbol('Payments.ReceivablesService');
