'use client';
import { Card, Metric } from './widgets';
import Link from 'next/link';

export function AccountantDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Табло на счетоводителя · Accountant</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="Чакащи прегледи" value="7" tone="warn" href="/review" />
        <Metric label="За корекция" value="2" tone="danger" href="/review" />
        <Metric label="Възложени на мен" value="3" tone="info" href="/review" />
        <Metric label="Одобрени днес" value="5" tone="ok" />
      </div>
      <Card>
        <h2 className="text-sm font-medium mb-3">Работен поток · Work queue</h2>
        <ol className="space-y-2 text-sm">
          <li className="flex justify-between"><Link className="text-info" href="/review">invoice-2026-04.pdf — 602 · 0.91</Link><span className="text-muted">за одобрение</span></li>
          <li className="flex justify-between"><Link className="text-info" href="/review">receipt-scan.png — 601 · 0.72</Link><span className="text-warn">ниска увереност</span></li>
          <li className="flex justify-between"><Link className="text-info" href="/posting">Одобрени за осчетоводяване</Link><span className="text-muted">2 чакат</span></li>
        </ol>
      </Card>
    </div>
  );
}
