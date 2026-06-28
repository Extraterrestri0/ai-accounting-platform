'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { FileText, Search, ChevronLeft, ChevronRight, Upload, Filter, Trash2, RotateCcw, AlertTriangle, History } from 'lucide-react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AuditHistoryDialog } from '@/components/app/audit/audit-history-dialog';
import { dateBG, bytes } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = [
  { key: '', label: 'Всички' },
  { key: 'scanning', label: 'Сканиране' },
  { key: 'ready', label: 'Извлечени' },
  { key: 'failed', label: 'Грешка' },
];
const PAGE_SIZE = 12;

export default function DocumentsPage() {
  const { activeCompany } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const companyId = activeCompany?.id;
  const [view, setView] = React.useState<'active' | 'trash'>('active');
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [status, setStatus] = React.useState('');
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
        actions={<Button asChild><Link href="/upload"><Upload className="h-4 w-4" /> Качи документ</Link></Button>}
      />

      {/* View tabs */}
      <div className="flex items-center gap-1.5">
        <ViewTab active={view === 'active'} onClick={() => { setView('active'); setPage(1); }} icon={FileText} label="Документи" />
        <ViewTab active={view === 'trash'} onClick={() => { setView('trash'); setPage(1); }} icon={Trash2} label="Кошче" />
      </div>

      <Card>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Търсене по име на файл…"
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {view === 'active' && (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <Filter className="mr-1 hidden h-4 w-4 text-muted-foreground sm:block" />
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => { setStatus(f.key); setPage(1); }}
                  className={cn('whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    status === f.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground')}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        {q.isLoading ? (
          <div className="p-4"><TableSkeleton rows={8} cols={5} /></div>
        ) : q.isError ? (
          <div className="p-6"><ErrorState onRetry={() => q.refetch()} /></div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={view === 'trash' ? Trash2 : FileText}
              title={view === 'trash' ? 'Кошчето е празно' : (debounced || status ? 'Няма съвпадения' : 'Все още няма документи')}
              description={view === 'trash' ? 'Изтритите документи се появяват тук и могат да бъдат възстановени.' : 'Качените документи ще се появят тук след обработка.'}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Файл</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Размер</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">{view === 'trash' ? 'Действия' : 'Качен на'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow
                  key={d.id}
                  className={view === 'active' ? 'cursor-pointer' : ''}
                  onClick={view === 'active' ? () => router.push(`/review/${d.id}`) : undefined}
                >
                  <TableCell className="font-medium text-foreground">
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-muted-foreground"><FileText className="h-4 w-4" /></span>
                      <span className="max-w-[18rem] truncate">{d.originalFilename ?? d.filename ?? '—'}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.detectedType ?? '—'}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{d.sizeBytes ? bytes(d.sizeBytes) : '—'}</TableCell>
                  <TableCell><StatusBadge status={d.status} /></TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {view === 'active' ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="tabular-nums text-muted-foreground">{dateBG(d.createdAt)}</span>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" title="Одитна история"
                          onClick={() => setAuditFor(d.id)}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" title="Премести в кошчето"
                          onClick={() => trash.mutate(d.id)} disabled={trash.isPending}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => restore.mutate(d.id)} disabled={restore.isPending}>
                          <RotateCcw className="h-4 w-4" /> Възстанови
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive-soft" title="Изтрий окончателно"
                          onClick={() => setConfirmId(d.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {items.length > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">{total} {total === 1 ? 'документ' : 'документа'} · страница {page} от {totalPages}</span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /> Назад</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Напред <ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
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
              <Trash2 className="h-4 w-4" /> Изтрий окончателно
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AuditHistoryDialog entityType="document" entityId={auditFor} subtitle="Хронология на действията по този документ." onOpenChange={(v) => !v && setAuditFor(null)} />
    </div>
  );
}

function ViewTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof FileText; label: string }) {
  return (
    <button onClick={onClick} className={cn('flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
      active ? 'bg-card text-foreground shadow-card border' : 'text-muted-foreground hover:text-foreground')}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
