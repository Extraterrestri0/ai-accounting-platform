'use client';

import * as React from 'react';
import { Sparkles, ShieldCheck, BookOpen, Eye } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { AssistantPanel } from '@/components/app/assistant-panel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const MONTHS = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];

/**
 * AI Accountant — one place for the read-only question playbooks that are also
 * embedded on the dashboard, VAT and reports screens (document questions live on
 * the review page). Uses the existing /assistant endpoints only.
 */
export default function AssistantPage() {
  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth() + 1);
  const years = [year - 2, year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i).sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI счетоводител"
        description="Обяснения с цитати от вашите данни — вземания, ДДС и резултат. Асистентът само чете: не осчетоводява, не одобрява и не подава нищо."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand" /> Вземания и задължения</CardTitle>
              <CardDescription>Кой ви дължи, кого да платите първо и какво е просрочено.</CardDescription>
            </CardHeader>
            <CardContent><AssistantPanel surface="dashboard" bare /></CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row flex-wrap items-end justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand" /> ДДС за период</CardTitle>
                <CardDescription>Защо дължите толкова, откъде идва и какво да проверите преди подаване.</CardDescription>
              </div>
              <div className="flex items-end gap-2">
                <div className="space-y-1"><Label className="text-2xs text-muted-foreground">Месец</Label>
                  <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-36">
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </Select></div>
                <div className="space-y-1"><Label className="text-2xs text-muted-foreground">Година</Label>
                  <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24">
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </Select></div>
              </div>
            </CardHeader>
            <CardContent><AssistantPanel key={`vat-${year}-${month}`} surface="vat" context={{ year, month }} bare /></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand" /> Резултат и разходи</CardTitle>
              <CardDescription>Защо печалбата е такава, разлика спрямо предходен месец, най-големи разходи.</CardDescription>
            </CardHeader>
            <CardContent><AssistantPanel key={`rep-${year}-${month}`} surface="reports" context={{ year, month }} bare /></CardContent>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader><CardTitle>Как работи</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-[13px] text-muted-foreground">
              <p className="flex gap-2.5"><Eye className="mt-0.5 h-4 w-4 shrink-0 text-faint" /> Всеки отговор се изгражда от записи в главната книга, регистрите и документите ви — не се генерират цифри.</p>
              <p className="flex gap-2.5"><BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-faint" /> Правилата са версионирани „карти“ с правно основание. Карта без счетоводен преглед се отбелязва и сваля увереността.</p>
              <p className="flex gap-2.5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-faint" /> Без отговор, когато данните не стигат. Всеки въпрос и отговор се записва в одитната следа.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Въпроси за документ</CardTitle></CardHeader>
            <CardContent className="text-[13px] text-muted-foreground">
              Защо е осчетоводен така, признат ли е данъчният кредит и кое правило е приложено — отворете документа от <a href="/review" className="text-brand underline-offset-2 hover:underline">опашката за преглед</a>.
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
