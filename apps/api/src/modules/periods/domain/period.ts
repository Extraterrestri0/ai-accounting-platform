/** Pure period helpers — no IO, unit-testable. */

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function periodKey(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

/** Extract {year, month} from an ISO date/datetime ('2026-06-06' or full ISO). */
export function ymOf(dateISO: string): { year: number; month: number } {
  const year = Number(dateISO.slice(0, 4));
  const month = Number(dateISO.slice(5, 7));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Invalid accounting date: ${dateISO}`);
  }
  return { year, month };
}

/** Validate a (year, month) pair, throwing on out-of-range input. */
export function assertValidYm(year: number, month: number): void {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new RangeError(`Invalid year: ${year}`);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError(`Invalid month: ${month}`);
}

/** The calendar month after (year, month). */
export function nextMonth(year: number, month: number): { year: number; month: number } {
  return month >= 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/** The calendar month before (year, month). */
export function prevMonth(year: number, month: number): { year: number; month: number } {
  return month <= 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/** A descending window of `count` months ending at (year, month) inclusive. */
export function recentMonths(year: number, month: number, count: number): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  let y = year, m = month;
  for (let i = 0; i < count; i++) {
    out.push({ year: y, month: m });
    const p = prevMonth(y, m); y = p.year; m = p.month;
  }
  return out;
}
