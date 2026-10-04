'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { AssistantPanel } from '@/components/app/assistant-panel';
import { EmptyState, TableSkeleton } from '@/components/app/states';
import { AgingTable } from '@/components/app/aging-table';
import { MonthlyReportPanel, CashFlowPanel } from '@/components/app/management-reports';
import { Money } from '@/components/app/money';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { eur, dateBG } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AgingReport, OpenItem } from '@/lib/api/types';

/** Report row shapes as returned by /reports/* (typed locally; API is untyped). */
interface TrialBalanceRow { accountCode: string; accountName: string; debit: string | number; credit: string | number; balance: string | number }
interface TrialBalance { rows: TrialBalanceRow[]; totals: { debit: string | number; credit: string | number; balanced: boolean } }
interface PnL { revenue: string | number; expense: string | number; netProfit: string | number }
interface GlLine { date: string; ref?: string; direction: 'debit' | 'credit'; amount: string | number; balance: string | number }
interface GlAccount { accountCode: string; accountName: string; lines?: GlLine[] }

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const yearStart = () => isoDate(new Date(new Date().getFullYear(), 0, 1));
const today = () => isoDate(new Date());

export default function ReportsPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const [draft, setDraft] = React.useState({ from: yearStart(), to: today() });
  const [{ from, to }, setRange] = React.useState(draft);
  const dirty = draft.from !== from || draft.to !== to;
  const year = Number(from.slice(0, 4)) || new Date().getFullYear();
  const month = Number(from.slice(5, 7)) || new Date().getMonth() + 1;

  const tbQ = useQuery({ queryKey: ['trialBalance', companyId, from, to], queryFn: () => Endpoints.trialBalance(from, to).catch(() => null), enabled: !!companyId });
  const pnlQ = useQuery({ queryKey: ['pnl', companyId, from, to], queryFn: () => Endpoints.profitAndLoss(from, to).catch(() => null), enabled: !!companyId });
  const glQ = useQuery({ queryKey: ['gl', companyId, from, to], queryFn: () => Endpoints.generalLedger(from, to).catch(() => []), enabled: !!companyId });
  const arAgingQ = useQuery({ queryKey: ['arap', 'ar', 'aging-report', companyId], queryFn: () => Endpoints.arAging().catch(() => null), enabled: !!companyId });
  const apAgingQ = useQuery({ queryKey: ['arap', 'ap', 'aging-report', companyId], queryFn: () => Endpoints.apAging().catch(() => null), enabled: !!companyId });

  const pnl = (pnlQ.data ?? null) as PnL | null;
  const tb = (tbQ.data ?? null) as TrialBalance | null;
  const gl = (glQ.data ?? []) as GlAccount[];
  const net = Number(pnl?.netProfit ?? 0);
  const rangeLabel = `${dateBG(from)} – ${dateBG(to)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Отчети"
        description="Финансови отчети от неизменяемата главна книга."
        actions={
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setRange(draft); }}>
            <div className="space-y-1"><Label htmlFor="r-from" className="t-caption">От</Label><Input id="r-from" type="date" value={draft.from} max={draft.to} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className="w-[9.5rem]" /></div>
            <div className="space-y-1"><Label htmlFor="r-to" className="t-caption">До</Label><Input id="r-to" type="date" value={draft.to} min={draft.from} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className="w-[9.5rem]" /></div>
            <Button type="submit" variant={dirty ? 'default' : 'outline'} disabled={!draft.from || !draft.to}>Приложи</Button>
          </form>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Приходи" value={eur(pnl?.revenue ?? 0)} sub={rangeLabel} icon={TrendingUp} tone="success" valueTone="success" loading={pnlQ.isLoading} />
        <StatCard label="Разходи" value={eur(pnl?.expense ?? 0)} sub={rangeLabel} icon={TrendingDown} tone="neutral" loading={pnlQ.isLoading} />
        <StatCard label="Финансов резултат" value={eur(net)} sub={net >= 0 ? 'Печалба за периода' : 'Загуба за периода'} icon={Scale} tone={net >= 0 ? 'success' : 'warning'} valueTone={net >= 0 ? 'success' : 'warning'} loading={pnlQ.isLoading} />
      </div>

      {/* AI Accountant — read-only explanations for the month of the "from" date (ADR-001) */}
      <AssistantPanel surface="reports" context={{ year, month }} />

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

        <TabsContent value="revenue"><MonthlyReportPanel kind="revenue" year={year} /></TabsContent>
        <TabsContent value="expenses"><MonthlyReportPanel kind="expenses" year={year} /></TabsContent>
        <TabsContent value="cashflow"><CashFlowPanel year={year} /></TabsContent>

        <TabsContent value="tb">
          <Card>
            <div className="flex flex-col gap-1 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Оборотна ведомост</CardTitle>
              <CardDescription>{rangeLabel}</CardDescription>
            </div>
            {tbQ.isLoading ? <TableSkeleton rows={6} cols={5} />
              : !tb || !tb.rows?.length ? <EmptyState icon={BarChart3} title="Няма движения" description="Оборотната ведомост ще се появи след осчетоводяване на документи." />
              : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Сметка</TableHead>
                        <TableHead>Наименование</TableHead>
                        <TableHead className="num">Дебит</TableHead>
                        <TableHead className="num">Кредит</TableHead>
                        <TableHead className="num">Салдо</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tb.rows.map((r) => (
                        <TableRow key={r.accountCode}>
                          <TableCell className="font-mono text-xs font-medium text-foreground">{r.accountCode}</TableCell>
                          <TableCell className="text-foreground">{r.accountName}</TableCell>
                          <TableCell className="num"><Money value={r.debit} /></TableCell>
                          <TableCell className="num"><Money value={r.credit} /></TableCell>
                          <TableCell className="num"><Money value={r.balance} strong /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-[13px] text-muted-foreground">
                    <span>Дебит <Money value={tb.totals.debit} className="text-foreground" /> · Кредит <Money value={tb.totals.credit} className="text-foreground" /></span>
                    {tb.totals.balanced ? <Badge variant="success" dot>Балансирано</Badge> : <Badge variant="destructive" dot>Дисбаланс</Badge>}
                  </div>
                </>
              )}
          </Card>
        </TabsContent>

        <TabsContent value="pnl">
          <Card>
            <div className="flex flex-col gap-1 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Отчет за приходите и разходите</CardTitle>
              <CardDescription>{rangeLabel}</CardDescription>
            </div>
            {pnlQ.isLoading ? <TableSkeleton rows={3} cols={2} /> : (
              <Table>
                <TableBody>
                  <TableRow><TableCell className="text-muted-foreground">Приходи</TableCell><TableCell className="num"><Money value={pnl?.revenue ?? 0} /></TableCell></TableRow>
                  <TableRow><TableCell className="text-muted-foreground">Разходи</TableCell><TableCell className="num"><Money value={pnl?.expense ?? 0} /></TableCell></TableRow>
                  <TableRow className="bg-surface-2/50 hover:bg-surface-2/50">
                    <TableCell className="font-semibold text-foreground">Финансов резултат</TableCell>
                    <TableCell className={cn('num text-[15px]', net >= 0 ? 'text-success' : 'text-warning')}><Money value={net} strong className={net >= 0 ? 'text-success' : 'text-warning'} /></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="gl">
          <Card>
            <div className="flex flex-col gap-1 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Главна книга</CardTitle>
              <CardDescription>{rangeLabel} · <span className="tabular-nums">{gl.length}</span> сметки</CardDescription>
            </div>
            {glQ.isLoading ? <TableSkeleton rows={6} cols={5} />
              : gl.length === 0 ? <EmptyState icon={BarChart3} title="Няма записи" description="Главната книга ще покаже движенията по сметки след осчетоводяване." />
              : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Дата</TableHead>
                      <TableHead>Документ</TableHead>
                      <TableHead className="num">Дебит</TableHead>
                      <TableHead className="num">Кредит</TableHead>
                      <TableHead className="num">Салдо</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gl.map((acc) => (
                      <React.Fragment key={acc.accountCode}>
                        <TableRow className="border-0 bg-surface-2/40 hover:bg-surface-2/40">
                          <TableCell colSpan={5} className="h-9 py-1">
                            <span className="font-mono text-xs font-medium text-foreground">{acc.accountCode}</span>
                            <span className="ml-2 font-medium text-foreground">{acc.accountName}</span>
                          </TableCell>
                        </TableRow>
                        {(acc.lines ?? []).map((l, i, arr) => (
                          <TableRow key={`${acc.accountCode}-${i}`} className={i === arr.length - 1 ? 'border-b border-border' : 'border-0'}>
                            <TableCell className="h-9 whitespace-nowrap py-1 tabular-nums text-muted-foreground">{dateBG(l.date)}</TableCell>
                            <TableCell className="h-9 py-1 font-mono text-xs text-muted-foreground">{l.ref ?? '—'}</TableCell>
                            <TableCell className="num h-9 py-1">{l.direction === 'debit' ? <Money value={l.amount} /> : <span className="text-faint">—</span>}</TableCell>
                            <TableCell className="num h-9 py-1">{l.direction === 'credit' ? <Money value={l.amount} /> : <span className="text-faint">—</span>}</TableCell>
                            <TableCell className="num h-9 py-1"><Money value={l.balance} strong /></TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
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
  if (items.length === 0) return <Card><EmptyState compact icon={BarChart3} title={emptyText} /></Card>;
  return (
    <Card>
      <div className="flex flex-col gap-1 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Отворени документи</CardTitle>
        <CardDescription><span className="tabular-nums">{items.length}</span> документа</CardDescription>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Документ</TableHead>
            <TableHead>{counterpartyLabel}</TableHead>
            <TableHead>Падеж</TableHead>
            <TableHead className="num">Просрочие</TableHead>
            <TableHead className="num">Остатък</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it: OpenItem) => (
            <TableRow key={`${it.documentType}:${it.documentId}`}>
              <TableCell className="font-medium text-foreground">{it.documentRef ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{it.counterpartyName ?? '—'}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{it.dueDate ? dateBG(it.dueDate) : '—'}</TableCell>
              <TableCell className="num">{it.overdueDays > 0 ? <span className="font-medium text-destructive">{it.overdueDays} дни</span> : <span className="text-faint">—</span>}</TableCell>
              <TableCell className="num"><Money value={it.outstanding} strong /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
