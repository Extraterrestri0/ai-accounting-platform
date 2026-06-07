import type { ApplicationService } from '../../../shared-kernel';
import type { AccountingPeriod } from '../domain/models';

/**
 * PUBLIC accounting-period service — the compliance gate for period locking.
 *
 * `assertOpen` is the guard the accounting writers (ledger, invoicing, payments,
 * posting, VAT) call BEFORE committing: it throws PeriodLockedError (409) when the
 * target accounting date falls in a locked period. Reads/locks are company-scoped
 * (tenant isolation is RLS). A period is OPEN by default until explicitly locked.
 */
export interface IAccountingPeriodService extends ApplicationService {
  /** Throw PeriodLockedError if the period containing this ISO date is locked. */
  assertOpen(dateISO: string, what?: string): Promise<void>;
  /** Whether (year, month) is locked. */
  isPeriodLocked(year: number, month: number): Promise<boolean>;
  /** Lock a period (human action; audited). */
  lockPeriod(year: number, month: number): Promise<AccountingPeriod>;
  /** Re-open a period (human action; audited). */
  openPeriod(year: number, month: number): Promise<AccountingPeriod>;
  /** The current calendar-month period for the active company. */
  getCurrentPeriod(): Promise<AccountingPeriod>;
  /** A window of recent periods (stored statuses overlaid on the calendar). */
  listPeriods(months?: number): Promise<AccountingPeriod[]>;
}
export const PERIOD_SERVICE = Symbol('Periods.AccountingPeriodService');
