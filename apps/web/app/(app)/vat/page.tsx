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
import { EmptyState } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { eur, bgn, dateBG } from '@/lib/format';

const MONTHS = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];
const NOW = { y: 2026, m: 6 };

export default function VatPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const qc = useQueryClient();
  const [year, setYear] = React.useState(NOW.y);
  const [month, setMonth] = React.useState(NOW.m);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="ДДС регистри"
        description="Дневници покупки/продажби и справка-декларация от осчетоводените записи."
        actions={
          <div className="flex items-center gap-2">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-9 rounded-lg border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 rounded-lg border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <Button onClick={() => build.mutate()} disabled={build.isPending}>
              {build.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hammer className="h-4 w-4" />} Построй регистри
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Изходящ ДДС (продажби)" value={eur(s?.outputVat ?? 0)} sub={`≈ ${bgn(s?.outputVat ?? 0)}`} icon={ArrowUpCircle} tone="primary" valueTone="primary" />
        <StatCard label="Данъчен кредит (покупки)" value={eur(s?.deductibleVat ?? 0)} sub={`≈ ${bgn(s?.deductibleVat ?? 0)}`} icon={ArrowDownCircle} tone="neutral" />
        <StatCard
          label={refundable > 0 ? 'ДДС за възстановяване' : 'ДДС за внасяне'}
          value={eur(refundable > 0 ? refundable : payable)}
          sub={`≈ ${bgn(refundable > 0 ? refundable : payable)} · ${MONTHS[month - 1]} ${year}`}
          icon={Scale}
          tone={refundable > 0 ? 'success' : payable > 0 ? 'warning' : 'success'}
          valueTone={refundable > 0 ? 'success' : payable > 0 ? 'warning' : 'success'}
        />
      </div>

      <Tabs defaultValue="purchase">
        <TabsList>
          <TabsTrigger value="purchase">Дневник покупки</TabsTrigger>
          <TabsTrigger value="sales">Дневник продажби</TabsTrigger>
          <TabsTrigger value="vies">VIES декларация</TabsTrigger>
        </TabsList>
        <TabsContent value="purchase"><RegisterTable rows={purchaseQ.data ?? []} kind="Покупки" /></TabsContent>
        <TabsContent value="sales"><RegisterTable rows={salesQ.data ?? []} kind="Продажби" /></TabsContent>
        <TabsContent value="vies"><ViesDatasetTab companyId={companyId} year={year} month={month} /></TabsContent>
      </Tabs>
    </div>
  );
}

function RegisterTable({ rows, kind }: { rows: any[]; kind: string }) {
  if (!rows || rows.length === 0) {
    return <Card><CardContent className="p-6"><EmptyState icon={ReceiptText} title={`Няма записи в дневник „${kind}“`} description="Построете регистрите за периода след като има осчетоводени документи." /></CardContent></Card>;
  }
  return (
    <Card>
      <Table>
        <TableHeader><TableRow><TableHead>Документ</TableHead><TableHead>Третиране</TableHead><TableHead className="text-right">Основа</TableHead><TableHead className="text-right">ДДС</TableHead><TableHead className="text-right">Кредит</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs text-muted-foreground">{r.documentRef ?? String(r.journalEntryId ?? '').slice(0, 8)}</TableCell>
              <TableCell>{r.treatment} · {r.rate}%</TableCell>
              <TableCell className="text-right tabular-nums">{eur(r.base)}</TableCell>
              <TableCell className="text-right tabular-nums">{eur(r.vat)}</TableCell>
              <TableCell className="text-right tabular-nums">{eur(r.deductible)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="text-sm text-muted-foreground">
          Вътреобщностни доставки към ЕС клиенти с валиден ДДС номер · {MONTHS[month - 1]} {year}
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting || rows.length === 0}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Експорт CSV
        </Button>
      </div>
      {q.isLoading ? (
        <CardContent className="p-6 text-sm text-muted-foreground">Зареждане…</CardContent>
      ) : rows.length === 0 ? (
        <CardContent className="p-6"><EmptyState icon={BadgeCheck} title="Няма ЕС доставки за периода" description="VIES декларацията се попълва от издадени фактури към ЕС клиенти с ДДС номер." /></CardContent>
      ) : (
        <>
          <Table>
            <TableHeader><TableRow><TableHead>Клиент</TableHead><TableHead>ДДС номер</TableHead><TableHead>Държава</TableHead><TableHead>Фактура</TableHead><TableHead>Дата</TableHead><TableHead className="text-right">Данъчна основа</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.invoiceId}>
                  <TableCell className="font-medium text-foreground">{r.counterpartyName}</TableCell>
                  <TableCell className="font-mono text-xs">{r.vatNumber}</TableCell>
                  <TableCell>{r.countryCode}</TableCell>
                  <TableCell>{r.invoiceNumber}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{dateBG(r.invoiceDate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{eur(r.taxableAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">{q.data?.count ?? 0} реда</span>
            <span className="text-muted-foreground">Общо основа: <span className="font-semibold text-foreground tabular-nums">{eur(q.data?.totalTaxable ?? 0)}</span></span>
          </div>
        </>
      )}
    </Card>
  );
}
