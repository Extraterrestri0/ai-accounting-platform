/** EUR functional currency; BGN reference until 08 Aug 2026 (fixed 1 EUR = 1.95583 BGN). */
export const EUR_BGN = 1.95583;

export function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'string' ? Number(v) : v;
}

/** BG-locale money: "1 234,56 €". */
export function eur(amount: number | string | null | undefined): string {
  const n = toNumber(amount);
  return new Intl.NumberFormat('bg-BG', { style: 'currency', currency: 'EUR' }).format(n);
}

/** BGN reference amount: "2 414,06 лв.". */
export function bgn(amount: number | string | null | undefined): string {
  const n = toNumber(amount) * EUR_BGN;
  return new Intl.NumberFormat('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' лв.';
}

export function num(amount: number | string | null | undefined, digits = 2): string {
  return new Intl.NumberFormat('bg-BG', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(toNumber(amount));
}

export function dateBG(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function dateTimeBG(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
