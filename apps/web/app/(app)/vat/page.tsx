'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ReceiptText, Hammer, ArrowDownCircle, ArrowUpCircle, Scale, Loader2, Download, BadgeCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { AssistantPanel } from '@/components/app/assistant-panel';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { Money } from '@/components/app/money';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { eur, dateBG } from '@/lib/format';

const MONTHS = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];
const THIS_YEAR = new Date().getFullYear();
const YEARS = [THIS_YEAR - 2, THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1];

/** VAT register row as returned by the purchase/sales register endpoints (typed locally; API is untyped). */
interface RegisterRow { documentRef?: string; journalEntryId?: string; counterpartyName?: string; date?: string; treatment: string; rate: number | string; base: string | number; vat: string | number; deductible: string | number }

export default function VatPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const qc = useQueryClient();
  const [year, setYear] = React.useState(THIS_YEAR);
  const [month, setMonth] = React.useState(new Date().getMonth() + 1);

  const summaryQ = useQuery({ queryKey: ['vatSummary', companyId, year, month], queryFn: () => Endpoints.vatSummary(year, month).catch(() => null), enabled: !!companyId });
  const purchaseQ = useQuery({ queryKey: ['vatPurchase', companyId, year, month], queryFn: () => Endpoints.vatPurchase(year, month).catch(() => []), enabled: !!companyId });
  const salesQ = useQuery({ queryKey: ['vatSales', companyId, year, month], queryFn: () => Endpoints.vatSales(year, month).catch(() => []), enabled: !!companyId });

  const build = useMutation({
    mutationFn: () => Endpoints.vatBuild(year, month),
    onSuccess: () => {
      toast.success('Регистрите са построени', { description: `${MONTHS[month - 1]} ${year}` });
      qc.invalidateQueries({ queryKey: ['vatSummary', companyId, year, month] });
      qc.invalidateQueries({ queryKey: ['vatPurchase', companyId, year, month] });
      qc.invalidateQueries({ queryKey: ['vatSales', companyId, year, month] });
    },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });

  const s = summaryQ.data;
  const payable = s ? s.vatPayable : 0;
  const refundable = s ? s.vatRefundable : 0;
  const periodLabel = `${MONTHS[month - 1]} ${year}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="ДДС регистри"
        description="Дневници покупки/продажби и справка-декларация от осчетоводените записи. Експорт за ръчно подаване към НАП."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label="Месец" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-36">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </Select>
            <Select aria-label="Година" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24">
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
            <Button onClick={() => build.mutate()} disabled={build.isPending}>
              {build.isPending ? <Loader2 className="animate-spin" /> : <Hammer />} Построй регистри
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Изходящ ДДС (продажби)" value={eur(s?.outputVat ?? 0)} sub={periodLabel} icon={ArrowUpCircle} tone="neutral" loading={summaryQ.isLoading} />
        <StatCard label="Данъчен кредит (покупки)" value={eur(s?.deductibleVat ?? 0)} sub={periodLabel} icon={ArrowDownCircle} tone="neutral" loading={summaryQ.isLoading} />
        <StatCard
          label={refundable > 0 ? 'ДДС за възстановяване' : 'ДДС за внасяне'}
          value={eur(refundable > 0 ? refundable : payable)}
          sub={refundable > 0 ? 'Резултат за периода: възстановяване' : payable > 0 ? 'Резултат за периода: внасяне' : 'Няма ДДС за периода'}
          icon={Scale}
          tone={refundable > 0 ? 'success' : payable > 0 ? 'warning' : 'neutral'}
          valueTone={refundable > 0 ? 'success' : payable > 0 ? 'warning' : 'foreground'}
          loading={summaryQ.isLoading}
        />
      </div>

      {/* AI Accountant — read-only explanations for the selected period (ADR-001) */}
      <AssistantPanel surface="vat" context={{ year, month }} />

      <Tabs defaultValue="purchase">
        <TabsList>
          <TabsTrigger value="purchase">Дневник покупки</TabsTrigger>
          <TabsTrigger value="sales">Дневник продажби</TabsTrigger>
          <TabsTrigger value="vies">VIES декларация</TabsTrigger>
        </TabsList>
        <TabsContent value="purchase"><RegisterTable rows={(purchaseQ.data ?? []) as RegisterRow[]} kind="Покупки" period={periodLabel} loading={purchaseQ.isLoading} creditLabel="Данъчен кредит" /></TabsContent>
        <TabsContent value="sales"><RegisterTable rows={(salesQ.data ?? []) as RegisterRow[]} kind="Продажби" period={periodLabel} loading={salesQ.isLoading} creditLabel="Данъчен кредит" /></TabsContent>
        <TabsContent value="vies"><ViesDatasetTab companyId={companyId} year={year} month={month} /></TabsContent>
      </Tabs>
    </div>
  );
}

function RegisterTable({ rows, kind, period, loading, creditLabel }: { rows: RegisterRow[]; kind: string; period: string; loading: boolean; creditLabel: string }) {
  const totals = rows.reduce((acc, r) => ({ base: acc.base + Number(r.base ?? 0), vat: acc.vat + Number(r.vat ?? 0), deductible: acc.deductible + Number(r.deductible ?? 0) }), { base: 0, vat: 0, deductible: 0 });
  return (
    <Card>
      <div className="flex flex-col gap-1 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Дневник „{kind}“</CardTitle>
        <CardDescription>{period} · <span className="tabular-nums">{rows.length}</span> реда</CardDescription>
      </div>
      {loading ? <TableSkeleton rows={6} cols={5} />
        : rows.length === 0 ? <EmptyState icon={ReceiptText} title={`Няма записи в дневник „${kind}“`} description="Построете регистрите за периода, след като има осчетоводени документи." />
        : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Документ</TableHead>
                  <TableHead>Третиране</TableHead>
                  <TableHead className="num">Данъчна основа</TableHead>
                  <TableHead className="num">ДДС</TableHead>
                  <TableHead className="num">{creditLabel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <span className="font-mono text-xs font-medium text-foreground">{r.documentRef ?? String(r.journalEntryId ?? '').slice(0, 8)}</span>
                      {r.counterpartyName && <span className="ml-2 text-muted-foreground">{r.counterpartyName}</span>}
                    </TableCell>
                    <TableCell><Badge variant="outline">{r.treatment} · {r.rate}%</Badge></TableCell>
                    <TableCell className="num"><Money value={r.base} /></TableCell>
                    <TableCell className="num"><Money value={r.vat} /></TableCell>
                    <TableCell className="num"><Money value={r.deductible} strong /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-border px-5 py-3 text-[13px] text-muted-foreground">
              <span>Основа <Money value={totals.base} className="text-foreground" /></span>
              <span>ДДС <Money value={totals.vat} className="text-foreground" /></span>
              <span>{creditLabel} <Money value={totals.deductible} strong className="text-foreground" /></span>
            </div>
          </>
        )}
    </Card>
  );
}

/** VIES (recapitulative) declaration dataset for the selected month + CSV export. */
function ViesDatasetTab({ companyId, year, month }: { companyId?: string; year: number; month: number }) {
  const q = useQuery({
    queryKey: ['viesDataset', companyId, year, month],
    queryFn: () => Endpoints.viesDataset(year, month),
    enabled: !!companyId,
  });
  const [exporting, setExporting] = React.useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const csv = await Endpoints.viesDatasetCsv(year, month);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `vies-${year}-${String(month).padStart(2, '0')}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast.success('CSV файлът е изтеглен');
    } catch (e) {
      toast.error('Грешка при експорт', { description: e instanceof ApiError ? e.message : '' });
    } finally { setExporting(false); }
  };

  const rows = q.data?.rows ?? [];
  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>VIES декларация</CardTitle>
          <CardDescription className="mt-0.5">Вътреобщностни доставки към клиенти от ЕС с валиден ДДС номер · {MONTHS[month - 1]} {year}</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting || rows.length === 0}>
          {exporting ? <Loader2 className="animate-spin" /> : <Download />} Експорт CSV
        </Button>
      </div>
      {q.isLoading ? <TableSkeleton rows={4} cols={6} />
        : q.isError ? <div className="p-5"><ErrorState onRetry={() => q.refetch()} /></div>
        : rows.length === 0 ? <EmptyState icon={BadgeCheck} title="Няма ЕС доставки за периода" description="VIES декларацията се попълва от издадени фактури към ЕС клиенти с ДДС номер." />
        : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Клиент</TableHead>
                  <TableHead>ДДС номер</TableHead>
                  <TableHead>Държава</TableHead>
                  <TableHead>Фактура</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="num">Данъчна основа</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.invoiceId}>
                    <TableCell className="font-medium text-foreground">{r.counterpartyName}</TableCell>
                    <TableCell className="font-mono text-xs">{r.vatNumber}</TableCell>
                    <TableCell><Badge variant="outline">{r.countryCode}</Badge></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.invoiceNumber}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{dateBG(r.invoiceDate)}</TableCell>
                    <TableCell className="num"><Money value={r.taxableAmount} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t border-border px-5 py-3 text-[13px] text-muted-foreground">
              <span><span className="tabular-nums text-foreground">{q.data?.count ?? 0}</span> реда</span>
              <span>Общо основа <Money value={q.data?.totalTaxable ?? 0} strong className="text-foreground" /></span>
            </div>
          </>
        )}
    </Card>
  );
}
