export type PeriodStatus = 'open' | 'locked';

/** An accounting period (a company's year+month) and its lock state. */
export interface AccountingPeriod {
  id?: string;             // null for a synthesized (never-touched) open period
  year: number;
  month: number;
  key: string;             // 'YYYY-MM'
  status: PeriodStatus;
  lockedBy?: string;
  lockedByEmail?: string;
  lockedAt?: string;
  isCurrent: boolean;      // matches the current calendar month
}
