'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Wallet, Download, Loader2, BarChart3 } from 'lucide-react';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/app/stat-card';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
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

/** Thin inline bar used in the monthly tables. */
function Bar({ value, max, tone }: { value: number; max: number; tone: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((Math.abs(value) / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Revenue/Expenses by month panel (table + bars + total + CSV export). */
export function MonthlyReportPanel({ kind, year }: { kind: 'revenue' | 'expenses'; year: number }) {
  const cfg = kind === 'revenue'
    ? { qf: () => Endpoints.revenueByMonth(year), csv: () => Endpoints.revenueByMonthCsv(year), label: 'Приходи', bar: 'bg-success', file: `revenue-${year}.csv` }
    : { qf: () => Endpoints.expensesByMonth(year), csv: () => Endpoints.expensesByMonthCsv(year), label: 'Разходи', bar: 'bg-warning', file: `expenses-${year}.csv` };
  const q = useQuery({ queryKey: ['report', kind, year], queryFn: cfg.qf });
  const [busy, setBusy] = React.useState(false);
  const s = q.data;
  const max = s ? Math.max(0, ...s.months.map((m) => Math.abs(toNumber(m.amount)))) : 0;
  const hasData = !!s && toNumber(s.total) !== 0;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="text-sm text-muted-foreground">{cfg.label} по месеци · {year}</div>
        <Button size="sm" variant="outline" disabled={busy || !hasData} onClick={() => downloadCsv(cfg.csv, cfg.file, setBusy)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Експорт CSV
        </Button>
      </div>
      {q.isLoading ? (
        <div className="p-4"><TableSkeleton rows={6} cols={3} /></div>
      ) : q.isError ? (
        <div className="p-6"><ErrorState onRetry={() => q.refetch()} /></div>
      ) : !hasData ? (
        <CardContent className="p-6"><EmptyState icon={BarChart3} title="Няма движения за годината" description="Отчетът се попълва от осчетоводени документи." /></CardContent>
      ) : (
        <>
          <Table>
            <TableHeader><TableRow><TableHead className="w-32">Месец</TableHead><TableHead>Разпределение</TableHead><TableHead className="text-right">{cfg.label}</TableHead></TableRow></TableHeader>
            <TableBody>
              {s!.months.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="font-medium text-foreground">{MONTHS_BG[m.month - 1]}</TableCell>
                  <TableCell><Bar value={toNumber(m.amount)} max={max} tone={cfg.bar} /></TableCell>
                  <TableCell className="text-right tabular-nums">{eur(m.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">Средно/месец: <span className="tabular-nums">{eur(s!.average)}</span></span>
            <span className="text-muted-foreground">Общо {year}: <span className="font-semibold text-foreground tabular-nums">{eur(s!.total)}</span></span>
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
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="text-sm text-muted-foreground">Паричен поток (сметка {c?.accountCode ?? '—'}) · {year}</div>
        <Button size="sm" variant="outline" disabled={busy || !hasData} onClick={() => downloadCsv(() => Endpoints.cashFlowCsv(year), `cash-flow-${year}.csv`, setBusy)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Експорт CSV
        </Button>
      </div>
      {q.isLoading ? (
        <div className="p-4"><TableSkeleton rows={6} cols={4} /></div>
      ) : q.isError ? (
        <div className="p-6"><ErrorState onRetry={() => q.refetch()} /></div>
      ) : !hasData ? (
        <CardContent className="p-6"><EmptyState icon={Wallet} title="Няма парични движения" description="Паричният поток се пълни от плащания и движения по разплащателната сметка." /></CardContent>
      ) : (
        <>
          <Table>
            <TableHeader><TableRow><TableHead className="w-28">Месец</TableHead><TableHead>Движение</TableHead><TableHead className="text-right">Постъпления</TableHead><TableHead className="text-right">Плащания</TableHead><TableHead className="text-right">Нетен поток</TableHead></TableRow></TableHeader>
            <TableBody>
              {c!.months.map((m) => {
                const net = toNumber(m.net);
                return (
                  <TableRow key={m.month}>
                    <TableCell className="font-medium text-foreground">{MONTHS_BG[m.month - 1]}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Bar value={toNumber(m.inflow)} max={max} tone="bg-success" />
                        <Bar value={toNumber(m.outflow)} max={max} tone="bg-destructive" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-success">{eur(m.inflow)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{eur(m.outflow)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums font-medium', net >= 0 ? 'text-foreground' : 'text-destructive')}>{eur(m.net)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-end gap-6 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">Постъпления: <span className="tabular-nums text-success">{eur(c!.totalInflow)}</span></span>
            <span className="text-muted-foreground">Плащания: <span className="tabular-nums text-destructive">{eur(c!.totalOutflow)}</span></span>
            <span className="text-muted-foreground">Нетен поток: <span className={cn('font-semibold tabular-nums', toNumber(c!.netCashFlow) >= 0 ? 'text-foreground' : 'text-destructive')}>{eur(c!.netCashFlow)}</span></span>
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
