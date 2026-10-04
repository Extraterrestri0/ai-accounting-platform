'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { FileText, Search, Upload, Trash2, RotateCcw, AlertTriangle, History } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import type { DocumentRow, Paginated } from '@/lib/api/types';
import { PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AuditHistoryDialog } from '@/components/app/audit/audit-history-dialog';
import { dateBG, bytes } from '@/lib/format';

type StatusKey = '' | 'scanning' | 'ready' | 'failed';
type View = 'active' | 'trash';

const STATUS_OPTIONS: { value: StatusKey; label: string }[] = [
  { value: '', label: 'Всички' },
  { value: 'scanning', label: 'Сканиране' },
  { value: 'ready', label: 'Извлечени' },
  { value: 'failed', label: 'Грешка' },
];
const VIEW_OPTIONS: { value: View; label: React.ReactNode }[] = [
  { value: 'active', label: <><FileText className="h-3.5 w-3.5" /> Документи</> },
  { value: 'trash', label: <><Trash2 className="h-3.5 w-3.5" /> Кошче</> },
];
const PAGE_SIZE = 12;

export default function DocumentsPage() {
  const { activeCompany } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const companyId = activeCompany?.id;
  const [view, setView] = React.useState<View>('active');
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [status, setStatus] = React.useState<StatusKey>('');
  const [page, setPage] = React.useState(1);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [auditFor, setAuditFor] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const effectiveStatus = view === 'trash' ? 'trashed' : status || undefined;

  const q = useQuery({
    queryKey: ['documents', companyId, { view, status, search: debounced, page }],
    queryFn: () => Endpoints.documents({ status: effectiveStatus, search: debounced || undefined, page, pageSize: PAGE_SIZE }),
    enabled: !!companyId,
    placeholderData: keepPreviousData,
    refetchInterval: view === 'active' ? 4000 : false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['documents'] });
  const onErr = (e: unknown) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' });

  const trash = useMutation({ mutationFn: (id: string) => Endpoints.trashDocument(id), onSuccess: () => { toast.success('Преместено в кошчето'); invalidate(); }, onError: onErr });
  const restore = useMutation({ mutationFn: (id: string) => Endpoints.restoreDocument(id), onSuccess: () => { toast.success('Възстановено'); invalidate(); }, onError: onErr });
  const purge = useMutation({ mutationFn: (id: string) => Endpoints.purgeDocument(id), onSuccess: () => { toast.success('Изтрито окончателно'); setConfirmId(null); invalidate(); }, onError: onErr });

  const data: Paginated<DocumentRow> | undefined = q.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Документи"
        description="Архив на всички качени документи за текущата фирма."
        actions={<Button asChild><Link href="/upload"><Upload /> Качи документ</Link></Button>}
      />

      <Card>
        {/* Toolbar: search · status filter · view toggle */}
        <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Търсене по име на файл…"
              className="pl-9"
              aria-label="Търсене по име на файл"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {view === 'active' && (
              <Segmented value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS_OPTIONS} />
            )}
            <Segmented value={view} onChange={(v) => { setView(v); setPage(1); }} options={VIEW_OPTIONS} />
          </div>
        </div>

        {/* Body */}
        {q.isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : q.isError ? (
          <div className="p-5"><ErrorState onRetry={() => q.refetch()} /></div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={view === 'trash' ? Trash2 : FileText}
            title={view === 'trash' ? 'Кошчето е празно' : (debounced || status ? 'Няма съвпадения' : 'Все още няма документи')}
            description={view === 'trash' ? 'Изтритите документи се появяват тук и могат да бъдат възстановени.' : 'Качените документи ще се появят тук след обработка.'}
            action={view === 'active' && !debounced && !status ? <Button asChild><Link href="/upload"><Upload /> Качи документ</Link></Button> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Файл</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead className="num text-right">Размер</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Качен на</TableHead>
                <TableHead className="w-24 text-right"><span className="sr-only">Действия</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow
                  key={d.id}
                  className={view === 'active' ? 'group cursor-pointer' : 'group'}
                  onClick={view === 'active' ? () => router.push(`/review/${d.id}`) : undefined}
                >
                  <TableCell className="font-medium text-foreground">
                    <span className="block max-w-[20rem] truncate">{d.originalFilename ?? d.filename ?? '—'}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.detectedType ?? '—'}</TableCell>
                  <TableCell className="num text-right text-muted-foreground">{d.sizeBytes ? bytes(d.sizeBytes) : '—'}</TableCell>
                  <TableCell><StatusBadge status={d.status} /></TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{dateBG(d.createdAt)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                      {view === 'active' ? (
                        <>
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground" title="Одитна история" aria-label="Одитна история"
                            onClick={() => setAuditFor(d.id)}>
                            <History />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" title="Премести в кошчето" aria-label="Премести в кошчето"
                            onClick={() => trash.mutate(d.id)} disabled={trash.isPending}>
                            <Trash2 />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground" title="Възстанови" aria-label="Възстанови"
                            onClick={() => restore.mutate(d.id)} disabled={restore.isPending}>
                            <RotateCcw />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" title="Изтрий окончателно" aria-label="Изтрий окончателно"
                            onClick={() => setConfirmId(d.id)}>
                            <Trash2 />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {items.length > 0 && (
          <Pagination page={page} totalPages={totalPages} total={total} unit={total === 1 ? 'документ' : 'документа'} onChange={setPage} />
        )}
      </Card>

      {/* Permanent delete confirmation */}
      <Dialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Окончателно изтриване</DialogTitle>
            <DialogDescription>
              Файлът ще бъде премахнат за постоянно и не може да бъде възстановен. Одитната следа се запазва съгласно изискванията.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmId(null)}>Отказ</Button>
            <Button variant="destructive" onClick={() => confirmId && purge.mutate(confirmId)} disabled={purge.isPending}>
              <Trash2 /> Изтрий окончателно
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AuditHistoryDialog entityType="document" entityId={auditFor} subtitle="Хронология на действията по този документ." onOpenChange={(v) => !v && setAuditFor(null)} />
    </div>
  );
}
