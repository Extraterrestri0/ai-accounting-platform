'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Wallet, Download, Loader2, BarChart3 } from 'lucide-react';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/app/stat-card';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { Money } from '@/components/app/money';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { eur, toNumber } from '@/lib/format';
import type { CashFlowReport, MonthlySeries } from '@/lib/api/types';

const MONTHS_BG = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];
const currentMonth = () => new Date().getMonth() + 1;

async function downloadCsv(fetcher: () => Promise<string>, filename: string, setBusy: (b: boolean) => void) {
  setBusy(true);
  try {
    const csv = await fetcher();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast.success('CSV файлът е изтеглен');
  } catch (e) {
    toast.error('Грешка при експорт', { description: e instanceof ApiError ? e.message : '' });
  } finally { setBusy(false); }
}

/** Thin inline bar used in the monthly tables: brand fill on a sunken track. */
function Bar({ value, max, tone = 'bg-brand/80', faded }: { value: number; max: number; tone?: string; faded?: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.round((Math.abs(value) / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" role="presentation">
      <div className={cn('h-full rounded-full transition-[width]', tone, faded && 'opacity-60')} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Card toolbar shared by the monthly panels: title + period on the left, CSV export on the right. */
function PanelToolbar({ title, period, busy, disabled, onExport }: { title: string; period: React.ReactNode; busy: boolean; disabled: boolean; onExport: () => void }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <CardTitle>{title}</CardTitle>
        <CardDescription className="mt-0.5">{period}</CardDescription>
      </div>
      <Button size="sm" variant="outline" disabled={busy || disabled} onClick={onExport}>
        {busy ? <Loader2 className="animate-spin" /> : <Download />} Експорт CSV
      </Button>
    </div>
  );
}

/** Revenue/Expenses by month panel (table + bars + total + CSV export). */
export function MonthlyReportPanel({ kind, year }: { kind: 'revenue' | 'expenses'; year: number }) {
  const cfg = kind === 'revenue'
    ? { qf: () => Endpoints.revenueByMonth(year), csv: () => Endpoints.revenueByMonthCsv(year), label: 'Приходи', title: 'Приходи по месеци', file: `revenue-${year}.csv` }
    : { qf: () => Endpoints.expensesByMonth(year), csv: () => Endpoints.expensesByMonthCsv(year), label: 'Разходи', title: 'Разходи по месеци', file: `expenses-${year}.csv` };
  const q = useQuery({ queryKey: ['report', kind, year], queryFn: cfg.qf });
  const [busy, setBusy] = React.useState(false);
  const s = q.data;
  const max = s ? Math.max(0, ...s.months.map((m) => Math.abs(toNumber(m.amount)))) : 0;
  const hasData = !!s && toNumber(s.total) !== 0;

  return (
    <Card>
      <PanelToolbar title={cfg.title} period={<>{year} · по месеци</>} busy={busy} disabled={!hasData} onExport={() => downloadCsv(cfg.csv, cfg.file, setBusy)} />
      {q.isLoading ? (
        <TableSkeleton rows={6} cols={3} />
      ) : q.isError ? (
        <div className="p-5"><ErrorState onRetry={() => q.refetch()} /></div>
      ) : !hasData ? (
        <EmptyState icon={BarChart3} title="Няма движения за годината" description="Отчетът се попълва от осчетоводени документи." />
      ) : (
        <>
          <Table>
            <TableHeader><TableRow><TableHead className="w-32">Месец</TableHead><TableHead>Разпределение</TableHead><TableHead className="num w-40">{cfg.label}</TableHead></TableRow></TableHeader>
            <TableBody>
              {s!.months.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="font-medium text-foreground">{MONTHS_BG[m.month - 1]}</TableCell>
                  <TableCell><Bar value={toNumber(m.amount)} max={max} /></TableCell>
                  <TableCell className="num"><Money value={m.amount} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-[13px] text-muted-foreground">
            <span>Средно на месец <Money value={s!.average} className="text-foreground" /></span>
            <span>Общо {year} <Money value={s!.total} strong className="text-foreground" /></span>
          </div>
        </>
      )}
    </Card>
  );
}

/** Cash-flow panel (inflow/outflow/net per month + totals + CSV export). */
export function CashFlowPanel({ year }: { year: number }) {
  const q = useQuery({ queryKey: ['report', 'cash-flow', year], queryFn: () => Endpoints.cashFlowReport(year) });
  const [busy, setBusy] = React.useState(false);
  const c = q.data;
  const max = c ? Math.max(0, ...c.months.map((m) => Math.max(toNumber(m.inflow), toNumber(m.outflow)))) : 0;
  const hasData = !!c && (toNumber(c.totalInflow) !== 0 || toNumber(c.totalOutflow) !== 0);

  return (
    <Card>
      <PanelToolbar title="Паричен поток" period={<>{year} · сметка {c?.accountCode ?? '—'}</>} busy={busy} disabled={!hasData} onExport={() => downloadCsv(() => Endpoints.cashFlowCsv(year), `cash-flow-${year}.csv`, setBusy)} />
      {q.isLoading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : q.isError ? (
        <div className="p-5"><ErrorState onRetry={() => q.refetch()} /></div>
      ) : !hasData ? (
        <EmptyState icon={Wallet} title="Няма парични движения" description="Паричният поток се пълни от плащания и движения по разплащателната сметка." />
      ) : (
        <>
          <Table>
            <TableHeader><TableRow><TableHead className="w-28">Месец</TableHead><TableHead>Движение</TableHead><TableHead className="num">Постъпления</TableHead><TableHead className="num">Плащания</TableHead><TableHead className="num">Нетен поток</TableHead></TableRow></TableHeader>
            <TableBody>
              {c!.months.map((m) => {
                const net = toNumber(m.net);
                return (
                  <TableRow key={m.month}>
                    <TableCell className="font-medium text-foreground">{MONTHS_BG[m.month - 1]}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Bar value={toNumber(m.inflow)} max={max} />
                        <Bar value={toNumber(m.outflow)} max={max} tone="bg-foreground/30" />
                      </div>
                    </TableCell>
                    <TableCell className="num"><Money value={m.inflow} /></TableCell>
                    <TableCell className="num"><Money value={m.outflow} className="text-muted-foreground" /></TableCell>
                    <TableCell className="num"><Money value={m.net} strong signed={net < 0} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-border px-5 py-3 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand/80" /> Постъпления <Money value={c!.totalInflow} className="text-foreground" /></span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-foreground/30" /> Плащания <Money value={c!.totalOutflow} className="text-foreground" /></span>
            <span>Нетен поток <Money value={c!.netCashFlow} strong signed={toNumber(c!.netCashFlow) < 0} className={toNumber(c!.netCashFlow) >= 0 ? 'text-foreground' : undefined} /></span>
          </div>
        </>
      )}
    </Card>
  );
}

// ---- Dashboard widgets (current-month figures) ----
export function RevenueWidget({ companyId, year }: { companyId?: string; year: number }) {
  const q = useQuery({ queryKey: ['report', 'revenue', year], queryFn: () => Endpoints.revenueByMonth(year), enabled: !!companyId });
  const v = q.data?.months[currentMonth() - 1]?.amount;
  return <StatCard label={`Приходи · ${MONTHS_BG[currentMonth() - 1]}`} value={q.isLoading ? '…' : eur(v ?? 0)} sub={q.data ? `Общо ${year}: ${eur(q.data.total)}` : undefined} icon={TrendingUp} tone="success" valueTone="success" />;
}
export function ExpensesWidget({ companyId, year }: { companyId?: string; year: number }) {
  const q = useQuery({ queryKey: ['report', 'expenses', year], queryFn: () => Endpoints.expensesByMonth(year), enabled: !!companyId });
  const v = q.data?.months[currentMonth() - 1]?.amount;
  return <StatCard label={`Разходи · ${MONTHS_BG[currentMonth() - 1]}`} value={q.isLoading ? '…' : eur(v ?? 0)} sub={q.data ? `Общо ${year}: ${eur(q.data.total)}` : undefined} icon={TrendingDown} tone="warning" valueTone="warning" />;
}
export function NetCashWidget({ companyId, year }: { companyId?: string; year: number }) {
  const q = useQuery({ queryKey: ['report', 'cash-flow', year], queryFn: () => Endpoints.cashFlowReport(year), enabled: !!companyId });
  const m = q.data?.months[currentMonth() - 1];
  const net = m ? toNumber(m.net) : 0;
  return <StatCard label={`Нетен паричен поток · ${MONTHS_BG[currentMonth() - 1]}`} value={q.isLoading || !m ? '…' : eur(m.net)} sub={q.data ? `Годишно: ${eur(q.data.netCashFlow)}` : undefined} icon={Wallet} tone={net >= 0 ? 'success' : 'warning'} valueTone={net >= 0 ? 'foreground' : 'warning'} />;
}

export type { MonthlySeries, CashFlowReport };
