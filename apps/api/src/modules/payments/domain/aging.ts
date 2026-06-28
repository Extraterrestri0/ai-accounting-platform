/**
 * Pure AR/AP arithmetic (Task 3.1) — no framework, no IO. The single source of
 * truth for outstanding balances, overdue days, aging buckets and summaries, so
 * the same deterministic math is exercised by unit tests and the services.
 *
 * All money is exact-decimal in MINOR UNITS internally (integer cents) to avoid
 * binary-float drift, then formatted back to a 2dp decimal string.
 */
import {
  AGING_BUCKETS, type AgingBucketKey, type AgingBucketRow, type ArApSummary, type OpenItem,
} from './models';

/** Parse a 2dp decimal string to integer cents (round-half-up, sign-aware). */
export function toCents(v: string | number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Format integer cents back to a 2dp decimal string. */
export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Outstanding = document total − Σ(payments). Never returns below zero. */
export function calcOutstanding(total: string | number, paid: string | number): string {
  const out = toCents(total) - toCents(paid);
  return fromCents(Math.max(0, out));
}

/** Whole days `asOf` is past `dueDate`. 0 when not yet due or no due date. */
export function calcOverdueDays(dueDate: string | undefined, asOf: string): number {
  if (!dueDate) return 0;
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const now = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(due) || !Number.isFinite(now)) return 0;
  const days = Math.floor((now - due) / 86_400_000);
  return days > 0 ? days : 0;
}

/** Map overdue days to a bucket. 0 (not yet due) → current. */
export function bucketOf(overdueDays: number): AgingBucketKey {
  if (overdueDays <= 0) return 'current';
  if (overdueDays <= 30) return 'd1_30';
  if (overdueDays <= 60) return 'd31_60';
  if (overdueDays <= 90) return 'd61_90';
  return 'd90_plus';
}

/**
 * Guard recording a payment: positive, and never more than what is owed.
 * Returns the validated amount in cents. Throws on overpayment / non-positive.
 * `epsilon` (1 cent) absorbs rounding so an exact full payment is always allowed.
 */
export function assertPayable(outstanding: string | number, amount: string | number): number {
  const amt = toCents(amount);
  const owed = toCents(outstanding);
  if (amt <= 0) throw new OverpaymentError('Payment amount must be positive.');
  if (owed <= 0) throw new OverpaymentError('This document is already settled.');
  if (amt > owed + 1) {
    throw new OverpaymentError(
      `Payment ${fromCents(amt)} exceeds the outstanding balance ${fromCents(owed)}.`,
    );
  }
  return amt;
}

export class OverpaymentError extends Error {}

/** Summarise open items into current vs overdue totals (+ counts). */
export function summarize(items: OpenItem[]): ArApSummary {
  let current = 0, overdue = 0, overdueCount = 0;
  for (const it of items) {
    const out = toCents(it.outstanding);
    if (it.overdueDays > 0) { overdue += out; overdueCount += 1; } else current += out;
  }
  return {
    current: fromCents(current),
    overdue: fromCents(overdue),
    total: fromCents(current + overdue),
    count: items.length,
    overdueCount,
  };
}

/** Distribute open items across the five aging buckets. */
export function buildAging(items: OpenItem[]): { buckets: AgingBucketRow[]; total: string } {
  const acc = new Map<AgingBucketKey, { amount: number; count: number }>(
    AGING_BUCKETS.map((b) => [b.key, { amount: 0, count: 0 }]),
  );
  let total = 0;
  for (const it of items) {
    const slot = acc.get(it.bucket)!;
    const out = toCents(it.outstanding);
    slot.amount += out; slot.count += 1; total += out;
  }
  const buckets: AgingBucketRow[] = AGING_BUCKETS.map((b) => ({
    key: b.key, label: b.label, amount: fromCents(acc.get(b.key)!.amount), count: acc.get(b.key)!.count,
  }));
  return { buckets, total: fromCents(total) };
}

/** Build the settlement + overdue fields for a raw open-document row. */
export function toOpenItem(
  row: Omit<OpenItem, 'outstanding' | 'overdueDays' | 'bucket'>, asOf: string,
): OpenItem {
  const outstanding = calcOutstanding(row.total, row.paid);
  const overdueDays = calcOverdueDays(row.dueDate, asOf);
  return { ...row, outstanding, overdueDays, bucket: bucketOf(overdueDays) };
}
