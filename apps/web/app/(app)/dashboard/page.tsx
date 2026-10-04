'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FileText, ClipboardCheck, ReceiptText, FileSpreadsheet, TrendingUp, Upload, ArrowRight, CalendarClock, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { useT } from '@/lib/i18n';
import type { DocumentRow, Paginated } from '@/lib/api/types';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { AssistantPanel } from '@/components/app/assistant-panel';
import { StatusBadge } from '@/components/app/status-badge';
import { ReceivablesWidget, PayablesWidget } from '@/components/app/arap-dashboard-widgets';
import { RecentActivityWidget } from '@/components/app/audit/recent-activity-widget';
import { CurrentPeriodWidget } from '@/components/app/current-period-widget';
import { RevenueWidget, ExpensesWidget, NetCashWidget } from '@/components/app/management-reports';
import { BankingWidget } from '@/components/app/banking-widget';
import { SaftReadinessWidget } from '@/components/app/saft-readiness-widget';
import { EmptyState, ErrorState, TableSkeleton, Notice } from '@/components/app/states';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dateBG, eur } from '@/lib/format';

/** Current calendar month and the previous one (the VAT period being filed by the 14th). */
function periods() {
  const now = new Date();
  const cur = { y: now.getFullYear(), m: now.getMonth() + 1 };
  const prev = cur.m === 1 ? { y: cur.y - 1, m: 12 } : { y: cur.y, m: cur.m - 1 };
  const label = (p: { y: number; m: number }) => `${String(p.m).padStart(2, '0')}/${p.y}`;
  return { cur, prev, curLabel: label(cur), prevLabel: label(prev), dayOfMonth: now.getDate() };
}

export default function DashboardPage() {
  const { activeCompany } = useAuth();
  const t = useT();
  const companyId = activeCompany?.id;
  const { cur, prev, curLabel, prevLabel, dayOfMonth } = periods();

  const docsQ = useQuery({
    queryKey: ['documents', companyId, 'dash'],
    queryFn: () => Endpoints.documents({ pageSize: 50 }),
    enabled: !!companyId,
  });
  const vatQ = useQuery({ queryKey: ['vatSummary', companyId, prev.y, prev.m], queryFn: () => Endpoints.vatSummary(prev.y, prev.m).catch(() => null), enabled: !!companyId });
  const pnlQ = useQuery({ queryKey: ['pnl', companyId, 'dash', cur.y], queryFn: () => Endpoints.profitAndLoss(`${cur.y}-01-01`, `${cur.y}-12-31`).catch(() => null), enabled: !!companyId });
  const invQ = useQuery({ queryKey: ['invoices', companyId], queryFn: () => Endpoints.invoices().catch(() => [] as any[]), enabled: !!companyId });

  const docs: Paginated<DocumentRow> | undefined = docsQ.data;
  const items = docs?.items ?? [];
  const pending = items.filter((d) => ['ready', 'ready_for_review', 'extracted', 'extracting', 'reviewing', 'clean'].includes(d.status)).length;
  const processing = items.filter((d) => ['scanning', 'uploaded', 'pending_scan'].includes(d.status)).length;
  const invoices = (invQ.data as any[]) ?? [];
  const issuedCount = invoices.filter((i) => i.status === 'issued').length;
  const draftCount = invoices.filter((i) => i.status === 'draft').length;
  const vatPayable = vatQ.data ? (vatQ.data.vatRefundable > 0 ? -vatQ.data.vatRefundable : vatQ.data.vatPayable) : 0;
  const netProfit = Number(pnlQ.data?.netProfit ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('dashboard.title')}
        description={activeCompany ? t('dashboard.subtitle', { company: `${activeCompany.name}${activeCompany.eik ? ` · ${t('settings.eik')} ${activeCompany.eik}` : ''}`, period: curLabel }) : ''}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/invoices"><Plus /> Нова фактура</Link>
            </Button>
            <Button asChild>
              <Link href="/upload"><Upload /> {t('dashboard.uploadDoc')}</Link>
            </Button>
          </>
        }
      />

      {/* VAT reminder: the previous month's return is due by the 14th. */}
      {dayOfMonth <= 14 && (
        <Notice
          tone="warning"
          icon={CalendarClock}
          title={t('dashboard.vatBanner')}
          action={<Button variant="outline" size="sm" asChild><Link href="/vat">{t('dashboard.vatBannerCta')} <ArrowRight /></Link></Button>}
        >
          {t('dashboard.vatBannerSub', { period: prevLabel })} · срок 14-ти
        </Notice>
      )}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('dashboard.kpiPendingReviews')} value={String(pending)} sub={processing > 0 ? t('dashboard.kpiDocsProcessing', { n: processing }) : t('dashboard.kpiAwaitingApproval')} icon={ClipboardCheck} tone={pending > 0 ? 'warning' : 'neutral'} valueTone={pending > 0 ? 'warning' : 'foreground'} href="/review" loading={docsQ.isLoading} />
        <StatCard
          label={vatPayable < 0 ? t('dashboard.kpiVatRefundable') : t('dashboard.kpiVatPayable')}
          value={eur(Math.abs(vatPayable))}
          sub={`период ${prevLabel}`}
          icon={ReceiptText}
          tone="primary"
          href="/vat"
          loading={vatQ.isLoading}
        />
        <StatCard label={t('dashboard.kpiInvoicesIssued')} value={String(issuedCount)} sub={t('dashboard.kpiDrafts', { n: draftCount })} icon={FileSpreadsheet} tone="neutral" href="/invoices" loading={invQ.isLoading} />
        <StatCard label={`${t('dashboard.kpiNetProfit')} · ${cur.y}`} value={eur(netProfit)} sub={t('dashboard.reportsSub')} icon={TrendingUp} tone="success" valueTone={netProfit > 0 ? 'success' : netProfit < 0 ? 'destructive' : 'foreground'} href="/reports" loading={pnlQ.isLoading} />
      </div>

      {/* Money position */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ReceivablesWidget companyId={companyId} />
        <PayablesWidget companyId={companyId} />
        <BankingWidget companyId={companyId} />
      </div>

      {/* Work queue + context */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Последни документи</CardTitle>
              <CardDescription>Най-новите качени документи за тази фирма.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/documents">Всички <ArrowRight /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {docsQ.isLoading ? (
              <TableSkeleton rows={5} cols={4} />
            ) : docsQ.isError ? (
              <div className="p-5"><ErrorState onRetry={() => docsQ.refetch()} /></div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Все още няма документи"
                description="Качете първата си фактура, за да започне обработката."
                action={<Button asChild><Link href="/upload"><Upload /> Качи документ</Link></Button>}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Файл</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.slice(0, 6).map((d) => (
                    <TableRow key={d.id} className="cursor-pointer" onClick={() => (window.location.href = `/review/${d.id}`)}>
                      <TableCell className="font-medium text-foreground">
                        <span className="block max-w-[22rem] truncate">{d.originalFilename ?? d.filename ?? '—'}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{d.detectedType ?? '—'}</TableCell>
                      <TableCell><StatusBadge status={d.status} /></TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{dateBG(d.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <CurrentPeriodWidget companyId={companyId} />
          <SaftReadinessWidget companyId={companyId} />
          <RecentActivityWidget companyId={companyId} />
        </div>
      </div>

      {/* Trend */}
      <div className="grid gap-4 lg:grid-cols-3">
        <RevenueWidget companyId={companyId} year={cur.y} />
        <ExpensesWidget companyId={companyId} year={cur.y} />
        <NetCashWidget companyId={companyId} year={cur.y} />
      </div>

      {/* AI Accountant — read-only Q&A (ADR-001) */}
      <AssistantPanel surface="dashboard" />
    </div>
  );
}
