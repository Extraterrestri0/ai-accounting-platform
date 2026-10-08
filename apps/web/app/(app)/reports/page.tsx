'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { AssistantPanel } from '@/components/app/assistant-panel';
import { EmptyState } from '@/components/app/states';
import { AgingTable } from '@/components/app/aging-table';
import { MonthlyReportPanel, CashFlowPanel } from '@/components/app/management-reports';
import { DualMoney } from '@/components/app/money';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { eur, dateBG } from '@/lib/format';
import type { AgingReport, OpenItem } from '@/lib/api/types';

export default function ReportsPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const [from, setFrom] = React.useState('2026-01-01');
  const [to, setTo] = React.useState('2026-12-31');

  const tbQ = useQuery({ queryKey: ['trialBalance', companyId, from, to], queryFn: () => Endpoints.trialBalance(from, to).catch(() => null), enabled: !!companyId });
  const pnlQ = useQuery({ queryKey: ['pnl', companyId, from, to], queryFn: () => Endpoints.profitAndLoss(from, to).catch(() => null), enabled: !!companyId });
  const glQ = useQuery({ queryKey: ['gl', companyId, from, to], queryFn: () => Endpoints.generalLedger(from, to).catch(() => []), enabled: !!companyId });
  const arAgingQ = useQuery({ queryKey: ['arap', 'ar', 'aging-report', companyId], queryFn: () => Endpoints.arAging().catch(() => null), enabled: !!companyId });
  const apAgingQ = useQuery({ queryKey: ['arap', 'ap', 'aging-report', companyId], queryFn: () => Endpoints.apAging().catch(() => null), enabled: !!companyId });

  const pnl = pnlQ.data;
  const tb = tbQ.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Отчети"
        description="Финансови отчети от неизменяемата главна книга."
        actions={
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
            <span className="text-muted-foreground">–</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Приходи" value={eur(pnl?.revenue ?? 0)} icon={TrendingUp} tone="success" valueTone="success" />
        <StatCard label="Разходи" value={eur(pnl?.expense ?? 0)} icon={TrendingDown} tone="neutral" />
        <StatCard label="Финансов резултат" value={eur(pnl?.netProfit ?? 0)} sub={Number(pnl?.netProfit ?? 0) >= 0 ? 'Печалба' : 'Загуба'} icon={Scale} tone={Number(pnl?.netProfit ?? 0) >= 0 ? 'success' : 'warning'} valueTone={Number(pnl?.netProfit ?? 0) >= 0 ? 'success' : 'warning'} />
      </div>

      {/* AI Accountant — read-only explanations for the month of the "from" date (ADR-001) */}
      <AssistantPanel surface="reports" context={{ year: Number(from.slice(0, 4)) || new Date().getFullYear(), month: Number(from.slice(5, 7)) || new Date().getMonth() + 1 }} />

      <Tabs defaultValue="tb">
        <TabsList>
          <TabsTrigger value="tb">Оборотна ведомост</TabsTrigger>
          <TabsTrigger value="pnl">ОПР</TabsTrigger>
          <TabsTrigger value="gl">Главна книга</TabsTrigger>
          <TabsTrigger value="revenue">Приходи/месец</TabsTrigger>
          <TabsTrigger value="expenses">Разходи/месец</TabsTrigger>
          <TabsTrigger value="cashflow">Паричен поток</TabsTrigger>
          <TabsTrigger value="ar">Падеж вземания</TabsTrigger>
          <TabsTrigger value="ap">Падеж задължения</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue"><MonthlyReportPanel kind="revenue" year={Number(from.slice(0, 4)) || new Date().getFullYear()} /></TabsContent>
        <TabsContent value="expenses"><MonthlyReportPanel kind="expenses" year={Number(from.slice(0, 4)) || new Date().getFullYear()} /></TabsContent>
        <TabsContent value="cashflow"><CashFlowPanel year={Number(from.slice(0, 4)) || new Date().getFullYear()} /></TabsContent>

        <TabsContent value="tb">
          <Card>
            {!tb || !tb.rows?.length ? (
              <CardContent className="p-6"><EmptyState icon={BarChart3} title="Няма движения" description="Оборотната ведомост ще се появи след осчетоводяване на документи." /></CardContent>
            ) : (
              <>
                <Table>
                  <TableHeader><TableRow><TableHead>Сметка</TableHead><TableHead>Наименование</TableHead><TableHead className="text-right">Дебит</TableHead><TableHead className="text-right">Кредит</TableHead><TableHead className="text-right">Салдо</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {tb.rows.map((r: any) => (
                      <TableRow key={r.accountCode}>
                        <TableCell className="font-mono text-xs">{r.accountCode}</TableCell>
                        <TableCell>{r.accountName}</TableCell>
                        <TableCell className="text-right tabular-nums">{eur(r.debit)}</TableCell>
                        <TableCell className="text-right tabular-nums">{eur(r.credit)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{eur(r.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Дебит {eur(tb.totals.debit)} · Кредит {eur(tb.totals.credit)}</span>
                  {tb.totals.balanced ? <Badge variant="success">Балансирано ✓</Badge> : <Badge variant="destructive">Дисбаланс</Badge>}
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="pnl">
          <Card>
            <CardContent className="space-y-3 p-6">
              <Row label="Приходи" value={eur(pnl?.revenue ?? 0)} />
              <Row label="Разходи" value={eur(pnl?.expense ?? 0)} />
              <div className="border-t pt-3"><Row label="Финансов резултат" value={eur(pnl?.netProfit ?? 0)} strong tone={Number(pnl?.netProfit ?? 0) >= 0 ? 'success' : 'warning'} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gl">
          <Card>
            {!glQ.data || glQ.data.length === 0 ? (
              <CardContent className="p-6"><EmptyState icon={BarChart3} title="Няма записи" description="Главната книга ще покаже движенията по сметки след осчетоводяване." /></CardContent>
            ) : (
              <div className="divide-y">
                {glQ.data.map((acc: any) => (
                  <div key={acc.accountCode} className="p-4">
                    <p className="mb-2 text-sm font-medium"><span className="font-mono text-xs text-muted-foreground">{acc.accountCode}</span> {acc.accountName}</p>
                    <div className="space-y-1">
                      {(acc.lines ?? []).map((l: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{l.date} {l.ref ?? ''}</span>
                          <span className="tabular-nums">{l.direction === 'debit' ? 'Dr' : 'Cr'} {eur(l.amount)} · салдо {eur(l.balance)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="ar" className="space-y-4">
          <AgingTable title="Падежен анализ на вземанията (AR Aging)" report={arAgingQ.data ?? undefined} isLoading={arAgingQ.isLoading} isError={arAgingQ.isError} onRetry={() => arAgingQ.refetch()} />
          <AgingItems report={arAgingQ.data ?? undefined} counterpartyLabel="Клиент" emptyText="Няма открити вземания." />
        </TabsContent>

        <TabsContent value="ap" className="space-y-4">
          <AgingTable title="Падежен анализ на задълженията (AP Aging)" report={apAgingQ.data ?? undefined} isLoading={apAgingQ.isLoading} isError={apAgingQ.isError} onRetry={() => apAgingQ.refetch()} />
          <AgingItems report={apAgingQ.data ?? undefined} counterpartyLabel="Доставчик" emptyText="Няма открити задължения." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Detail rows behind an aging report (document-level open items). */
function AgingItems({ report, counterpartyLabel, emptyText }: { report?: AgingReport; counterpartyLabel: string; emptyText: string }) {
  const items = report?.items ?? [];
  if (!report) return null;
  if (items.length === 0) return <Card><CardContent className="p-6"><EmptyState icon={BarChart3} title={emptyText} /></CardContent></Card>;
  return (
    <Card>
      <Table>
        <TableHeader><TableRow><TableHead>Документ</TableHead><TableHead>{counterpartyLabel}</TableHead><TableHead>Падеж</TableHead><TableHead className="text-right">Просрочие</TableHead><TableHead className="text-right">Остатък</TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((it: OpenItem) => (
            <TableRow key={`${it.documentType}:${it.documentId}`}>
              <TableCell className="font-medium text-foreground">{it.documentRef ?? '—'}</TableCell>
              <TableCell>{it.counterpartyName ?? '—'}</TableCell>
              <TableCell className="tabular-nums text-muted-foreground">{it.dueDate ? dateBG(it.dueDate) : '—'}</TableCell>
              <TableCell className="text-right tabular-nums">{it.overdueDays > 0 ? <span className="text-destructive">{it.overdueDays} дни</span> : '—'}</TableCell>
              <TableCell className="text-right"><DualMoney value={it.outstanding} strong /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'success' | 'warning' }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className={`tabular-nums ${strong ? 'text-lg font-semibold' : 'font-medium'} ${tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}
