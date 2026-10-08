'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FileText, ClipboardCheck, ReceiptText, FileSpreadsheet, TrendingUp, BarChart3, Upload, ArrowRight, Building2, CalendarClock } from 'lucide-react';
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
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dateBG, eur } from '@/lib/format';

const NOW = { y: 2026, m: 6 };
const PERIOD = '05/2026';

export default function DashboardPage() {
  const { activeCompany } = useAuth();
  const t = useT();
  const companyId = activeCompany?.id;

  const docsQ = useQuery({
    queryKey: ['documents', companyId, 'dash'],
    queryFn: () => Endpoints.documents({ pageSize: 50 }),
    enabled: !!companyId,
  });
  const vatQ = useQuery({ queryKey: ['vatSummary', companyId, NOW.y, NOW.m], queryFn: () => Endpoints.vatSummary(NOW.y, NOW.m).catch(() => null), enabled: !!companyId });
  const pnlQ = useQuery({ queryKey: ['pnl', companyId, 'dash'], queryFn: () => Endpoints.profitAndLoss('2026-01-01', '2026-12-31').catch(() => null), enabled: !!companyId });
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
        description={activeCompany ? t('dashboard.subtitle', { company: `${activeCompany.name}${activeCompany.eik ? ` · ${t('settings.eik')} ${activeCompany.eik}` : ''}`, period: PERIOD }) : ''}
        actions={
          <Button asChild>
            <Link href="/upload"><Upload className="h-4 w-4" /> {t('dashboard.uploadDoc')}</Link>
          </Button>
        }
      />

      {/* VAT reminder banner */}
      <Link href="/vat" className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm transition-colors hover:bg-warning-soft/70">
        <CalendarClock className="h-5 w-5 shrink-0 text-warning" />
        <span className="flex-1 text-foreground"><span className="font-semibold">{t('dashboard.vatBanner')}</span> · {t('dashboard.vatBannerSub', { period: PERIOD })}</span>
        <span className="hidden items-center gap-1 text-primary sm:flex">{t('dashboard.vatBannerCta')} <ArrowRight className="h-4 w-4" /></span>
      </Link>

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label={t('dashboard.kpiDocsToProcess')} value={docsQ.isLoading ? '…' : String(docs?.total ?? 0)} sub={t('dashboard.kpiDocsProcessing', { n: processing })} icon={FileText} tone="primary" />
        <StatCard label={t('dashboard.kpiPendingReviews')} value={docsQ.isLoading ? '…' : String(pending)} sub={t('dashboard.kpiAwaitingApproval')} icon={ClipboardCheck} tone="warning" valueTone={pending > 0 ? 'warning' : 'foreground'} />
        <StatCard
          label={vatPayable < 0 ? t('dashboard.kpiVatRefundable') : t('dashboard.kpiVatPayable')}
          value={eur(Math.abs(vatPayable))}
          sub={PERIOD}
          icon={ReceiptText}
          tone="primary"
          valueTone="primary"
        />
        <StatCard label={t('dashboard.kpiInvoicesIssued')} value={invQ.isLoading ? '…' : String(issuedCount)} sub={t('dashboard.kpiDrafts', { n: draftCount })} icon={FileSpreadsheet} tone="neutral" />
        <StatCard label={t('dashboard.kpiNetProfit')} value={eur(netProfit)} icon={TrendingUp} tone="success" valueTone={netProfit >= 0 ? 'success' : 'warning'} />
        <StatCard label={t('dashboard.kpiReportsStatus')} value={netProfit !== 0 ? t('dashboard.kpiReady') : '—'} sub={t('dashboard.reportsSub')} icon={BarChart3} tone="success" valueTone={netProfit !== 0 ? 'success' : 'foreground'} />
        <CurrentPeriodWidget companyId={companyId} />
        <RevenueWidget companyId={companyId} year={NOW.y} />
        <ExpensesWidget companyId={companyId} year={NOW.y} />
        <NetCashWidget companyId={companyId} year={NOW.y} />
      </div>

      {/* AI Accountant — read-only Q&A over receivables/payables (ADR-001) */}
      <AssistantPanel surface="dashboard" />

      {/* Receivables & Payables (Task 3.1) + Banking (Task 3.2) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ReceivablesWidget companyId={companyId} />
        <PayablesWidget companyId={companyId} />
        <BankingWidget companyId={companyId} />
        <SaftReadinessWidget companyId={companyId} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent documents */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Последни документи</CardTitle>
              <CardDescription>Най-новите качени документи за тази фирма.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/documents">Всички <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {docsQ.isLoading ? (
              <div className="p-4"><TableSkeleton rows={5} cols={4} /></div>
            ) : docsQ.isError ? (
              <div className="p-4"><ErrorState onRetry={() => docsQ.refetch()} /></div>
            ) : items.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={FileText}
                  title="Все още няма документи"
                  description="Качете първата си фактура, за да започне обработката с AI."
                  action={<Button asChild><Link href="/upload"><Upload className="h-4 w-4" /> Качи документ</Link></Button>}
                />
              </div>
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
                    <TableRow key={d.id}>
                      <TableCell className="font-medium text-foreground">
                        <span className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="max-w-[18rem] truncate">{d.originalFilename ?? d.filename ?? '—'}</span>
                        </span>
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

        {/* Company card + quick actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Текуща фирма</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft text-accent-foreground">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{activeCompany?.name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{activeCompany?.eik ? `ЕИК ${activeCompany.eik}` : 'Без ЕИК'}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-secondary/60 p-3">
                  <dt className="text-xs text-muted-foreground">Валута</dt>
                  <dd className="font-medium text-foreground">{activeCompany?.baseCurrency ?? 'EUR'}</dd>
                </div>
                <div className="rounded-lg bg-secondary/60 p-3">
                  <dt className="text-xs text-muted-foreground">ДДС статус</dt>
                  <dd className="font-medium capitalize text-foreground">{activeCompany?.vatStatus ?? '—'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Бързи действия</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <QuickAction href="/upload" icon={Upload} label="Качи документ" desc="PDF или изображение" />
              <QuickAction href="/documents" icon={FileText} label="Архив с документи" desc="Преглед и филтриране" />
            </CardContent>
          </Card>

          <RecentActivityWidget companyId={companyId} />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, desc }: { href: string; icon: typeof Upload; label: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-primary-soft/40">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-accent-foreground"><Icon className="h-4 w-4" /></span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
