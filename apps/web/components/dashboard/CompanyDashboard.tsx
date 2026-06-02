'use client';
import { Card, Metric } from './widgets';
import { useApp } from '../shell/AppContext';
import { dual } from '@/lib/money';

export function CompanyDashboard() {
  const { company } = useApp();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Фирмено табло · {company.name}</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="Приходи 04/2026" value={dual(300)} tone="ok" href="/reports" />
        <Metric label="Разходи 04/2026" value={dual(100)} tone="ink" href="/reports" />
        <Metric label="ДДС за внасяне" value={dual(20)} tone="info" href="/vat" />
        <Metric label="Издадени фактури" value="1" tone="ink" href="/invoices" />
      </div>
      <Card>
        <h2 className="text-sm font-medium mb-2">Съответствие · Compliance</h2>
        <ul className="text-sm space-y-1.5">
          <li className="flex justify-between"><span>Регистрация по ДДС</span><span className="text-ok">активна</span></li>
          <li className="flex justify-between"><span>Дневник покупки/продажби 04/2026</span><span className="text-ok">генериран</span></li>
          <li className="flex justify-between"><span>Справка-декларация по ЗДДС</span><span className="text-warn">чернова</span></li>
        </ul>
      </Card>
    </div>
  );
}
