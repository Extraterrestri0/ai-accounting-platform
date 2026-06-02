/** EUR is the functional currency; BGN shown alongside until 08 Aug 2026 (fixed 1 EUR = 1.95583 BGN). */
export const EUR_BGN = 1.95583;
export function eur(amount: number | string): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  return `${n.toFixed(2)} €`;
}
export function dual(amount: number | string): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  return `${n.toFixed(2)} € (${(n * EUR_BGN).toFixed(2)} лв.)`;
}
