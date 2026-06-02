'use client';
/** Reports Dashboard — entry point to all reports with a period selector. */
import { useState } from 'react';
const REPORTS = [
  ['Trial Balance', '/reports/trial-balance'], ['General Ledger', '/reports/general-ledger'],
  ['Account Card', '/reports/account-card'], ['Journal', '/reports/journal'],
  ['Profit & Loss', '/reports/profit-and-loss'], ['Balance Sheet', '/reports/balance-sheet'],
  ['VAT Report', '/reports/vat'], ['Invoice Report', '/reports/invoices'],
] as const;
export function ReportsDashboardScreen() {
  const [from, setFrom] = useState('2026-04-01'); const [to, setTo] = useState('2026-04-30');
  return (
    <section>
      <h1>Отчети · Reports</h1>
      <div role="search">
        <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <ul>{REPORTS.map(([label, href]) => (<li key={href}><a href={`${href}?from=${from}&to=${to}`}>{label}</a></li>))}</ul>
    </section>
  );
}
