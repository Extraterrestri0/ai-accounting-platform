'use client';
import { Card, Metric, ActivityList } from './widgets';
import { useApp } from '../shell/AppContext';
import { dual } from '@/lib/money';
import { t } from '@/lib/i18n';

export function MainDashboard() {
  const { company } = useApp();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Табло · Dashboard</h1>
        <p className="text-sm text-muted">{company.name} · ЕИК {company.eik} · период 04/2026</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Metric label={t.widgets.documentsPending} value="2" sub="1 сканира се" tone="info" href="/documents" />
        <Metric label={t.widgets.reviewsPending} value="7" sub="2 за корекция" tone="warn" href="/review" />
        <Metric label={t.widgets.invoicesIssued} value="1" sub="1 чернова" tone="ink" href="/invoices" />
        <Metric label={t.widgets.vatPayable} value={dual(20)} sub="04/2026" tone="info" href="/vat" />
        <Metric label={t.widgets.reportsStatus} value="Готови" sub="ОВ · ОПР · баланс" tone="ok" href="/reports" />
        <Metric label="Нетна печалба" value={dual(200)} sub="04/2026" tone="ok" href="/reports" />
      </div>
      <Card>
        <h2 className="text-sm font-medium mb-2">{t.widgets.recentActivity}</h2>
        <ActivityList items={[
          { when: 'преди 5 мин', text: 'Фактура 2026-0001 осчетоводена (Dr 411 / Cr 702 / Cr 4532) и изпратена.' },
          { when: 'преди 1 ч', text: 'Преглед одобрен от счетоводител · документ invoice-2026-04.pdf.' },
          { when: 'преди 2 ч', text: 'AI предложи сметка 602 (увереност 0.91) за Acme OOD.' },
          { when: 'преди 2 ч', text: 'Извлечени 13 полета от invoice-2026-04.pdf (OCR).' },
        ]} />
      </Card>
    </div>
  );
}
