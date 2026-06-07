import {
  assertPayable, bucketOf, buildAging, calcOutstanding, calcOverdueDays, fromCents, OverpaymentError,
  summarize, toCents, toOpenItem,
} from '../../src/modules/payments/domain/aging';
import type { OpenItem } from '../../src/modules/payments/domain/models';

// A standard BG invoice: net 200 + VAT 40 = gross 240.00.
const GROSS = '240.00';

describe('outstanding balance (Task 3.1)', () => {
  it('full payment settles the document to zero', () => {
    expect(calcOutstanding(GROSS, '240.00')).toBe('0.00');
  });

  it('partial payment leaves the remainder outstanding', () => {
    expect(calcOutstanding(GROSS, '100.00')).toBe('140.00');
  });

  it('multiple partial payments accumulate to full settlement', () => {
    const paidCents = toCents('100.00') + toCents('50.00') + toCents('90.00'); // 240.00
    expect(calcOutstanding(GROSS, fromCents(paidCents))).toBe('0.00');
  });

  it('reversing a payment restores the full outstanding balance', () => {
    // After recording 240 then reversing it, the ACTIVE paid sum drops back to 0.
    const activePaidAfterReversal = '0.00';
    expect(calcOutstanding(GROSS, activePaidAfterReversal)).toBe('240.00');
  });

  it('never reports a negative outstanding (defensive)', () => {
    expect(calcOutstanding(GROSS, '500.00')).toBe('0.00');
  });

  it('uses exact decimal math (no float drift)', () => {
    expect(calcOutstanding('0.30', '0.10')).toBe('0.20'); // 0.3 - 0.1 != 0.19999 here
  });
});

describe('overpayment prevention (Task 3.1)', () => {
  it('allows an exact full payment', () => {
    expect(assertPayable('140.00', '140.00')).toBe(14000);
  });

  it('allows a partial payment within the balance', () => {
    expect(assertPayable('140.00', '100.00')).toBe(10000);
  });

  it('rejects a payment that exceeds the outstanding balance', () => {
    expect(() => assertPayable('140.00', '200.00')).toThrow(OverpaymentError);
  });

  it('rejects a non-positive amount', () => {
    expect(() => assertPayable('140.00', '0')).toThrow(OverpaymentError);
    expect(() => assertPayable('140.00', '-10')).toThrow(OverpaymentError);
  });

  it('rejects paying an already-settled document', () => {
    expect(() => assertPayable('0.00', '10.00')).toThrow(OverpaymentError);
  });
});

describe('overdue days + buckets (Task 3.1)', () => {
  const asOf = '2026-06-05';
  it('is zero before / on the due date', () => {
    expect(calcOverdueDays('2026-06-10', asOf)).toBe(0);
    expect(calcOverdueDays('2026-06-05', asOf)).toBe(0);
    expect(calcOverdueDays(undefined, asOf)).toBe(0);
  });
  it('counts whole days past due', () => {
    expect(calcOverdueDays('2026-05-20', asOf)).toBe(16);
    expect(calcOverdueDays('2026-06-04', asOf)).toBe(1);
  });
  it('maps days to the five aging buckets', () => {
    expect(bucketOf(0)).toBe('current');
    expect(bucketOf(1)).toBe('d1_30');
    expect(bucketOf(30)).toBe('d1_30');
    expect(bucketOf(31)).toBe('d31_60');
    expect(bucketOf(60)).toBe('d31_60');
    expect(bucketOf(61)).toBe('d61_90');
    expect(bucketOf(90)).toBe('d61_90');
    expect(bucketOf(91)).toBe('d90_plus');
    expect(bucketOf(400)).toBe('d90_plus');
  });
});

// Build a set of open items with known overdue states for aging / summary tests.
const asOf = '2026-06-05';
const raw = (documentId: string, total: string, paid: string, dueDate: string) =>
  toOpenItem({
    documentType: 'sales_invoice', documentId, documentRef: documentId,
    currency: 'EUR', total, paid, dueDate,
  }, asOf);

const arItems: OpenItem[] = [
  raw('cur', '100.00', '0.00', '2026-06-30'),  // current
  raw('b1', '200.00', '50.00', '2026-05-20'),  // 16 days -> 1-30, outstanding 150
  raw('b2', '300.00', '0.00', '2026-04-20'),   // 46 days -> 31-60
  raw('b3', '90.00', '0.00', '2026-03-20'),    // 77 days -> 61-90
  raw('b4', '10.00', '0.00', '2026-01-01'),    // >90    -> 90+
];

describe('AR aging report (Task 3.1)', () => {
  it('distributes outstanding across the five buckets', () => {
    const { buckets, total } = buildAging(arItems);
    const by = Object.fromEntries(buckets.map((b) => [b.key, b]));
    expect(by.current.amount).toBe('100.00');
    expect(by.d1_30.amount).toBe('150.00');
    expect(by.d31_60.amount).toBe('300.00');
    expect(by.d61_90.amount).toBe('90.00');
    expect(by.d90_plus.amount).toBe('10.00');
    expect(by.d1_30.count).toBe(1);
    expect(total).toBe('650.00');
  });

  it('labels the buckets in the BG-standard ranges', () => {
    const { buckets } = buildAging(arItems);
    expect(buckets.map((b) => b.label)).toEqual(['Current', '1–30', '31–60', '61–90', '90+']);
  });
});

describe('AP aging report (Task 3.1)', () => {
  // Payables share the OpenItem shape; only the document type differs.
  const apItems: OpenItem[] = [
    toOpenItem({ documentType: 'purchase_invoice', documentId: 'p1', currency: 'EUR', total: '480.00', paid: '0.00', dueDate: '2026-05-01' }, asOf), // 35 -> 31-60
    toOpenItem({ documentType: 'purchase_invoice', documentId: 'p2', currency: 'EUR', total: '120.00', paid: '120.00', dueDate: '2026-05-01' }, asOf), // settled -> excluded by service
  ];
  it('buckets unpaid supplier balances and ignores settled rows in totals', () => {
    const open = apItems.filter((it) => toCents(it.outstanding) > 0);
    const { buckets, total } = buildAging(open);
    const by = Object.fromEntries(buckets.map((b) => [b.key, b]));
    expect(by.d31_60.amount).toBe('480.00');
    expect(total).toBe('480.00');
    expect(open).toHaveLength(1);
  });
});

describe('dashboard summary calculations (Task 3.1)', () => {
  it('splits current vs overdue with counts', () => {
    const s = summarize(arItems);
    expect(s.current).toBe('100.00');                 // only the not-yet-due item
    expect(s.overdue).toBe('550.00');                 // 150 + 300 + 90 + 10
    expect(s.total).toBe('650.00');
    expect(s.count).toBe(5);
    expect(s.overdueCount).toBe(4);
  });

  it('an empty ledger yields zeroed totals', () => {
    const s = summarize([]);
    expect(s).toEqual({ current: '0.00', overdue: '0.00', total: '0.00', count: 0, overdueCount: 0 });
  });
});
