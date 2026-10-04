'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState, ErrorState, TableSkeleton, Notice } from '@/components/app/states';
import { Money } from '@/components/app/money';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dateBG, toNumber } from '@/lib/format';

/** Journal report row shape as returned by /reports/journal (typed locally; API returns untyped JSON). */
interface JournalLine { accountCode: string; accountName?: string; direction: 'debit' | 'credit'; amount: string | number }
interface JournalEntryRow { entryNo: string | number; date: string; description?: string; sourceType?: string; lines?: JournalLine[] }

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const yearStart = () => isoDate(new Date(new Date().getFullYear(), 0, 1));
const today = () => isoDate(new Date());

export default function PostingPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const [draft, setDraft] = React.useState({ from: yearStart(), to: today() });
  const [range, setRange] = React.useState(draft);

  const q = useQuery({ queryKey: ['journal', companyId, range.from, range.to], queryFn: () => Endpoints.journalReport(range.from, range.to).catch(() => []), enabled: !!companyId });
  const entries = (q.data ?? []) as JournalEntryRow[];
  const dirty = draft.from !== range.from || draft.to !== range.to;

  return (
    <div className="space-y-6">
      <PageHeader title="Осчетоводяване" description="Неизменяема главна книга. Всеки запис е балансиран и с одитна следа." />

      <Notice tone="success" icon={ShieldCheck} title="Записите са само за добавяне">
        Корекции се правят единствено със сторниращи записи. Нищо тук не може да бъде редактирано или изтрито.
      </Notice>

      <Card>
        <form
          className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-end sm:justify-between"
          onSubmit={(e) => { e.preventDefault(); setRange(draft); }}
        >
          <CardTitle className="sm:pb-2">Журнал на записите</CardTitle>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><Label htmlFor="j-from" className="t-caption">От</Label><Input id="j-from" type="date" value={draft.from} max={draft.to} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className="w-[9.5rem]" /></div>
            <div className="space-y-1"><Label htmlFor="j-to" className="t-caption">До</Label><Input id="j-to" type="date" value={draft.to} min={draft.from} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className="w-[9.5rem]" /></div>
            <Button type="submit" variant={dirty ? 'default' : 'outline'} disabled={!draft.from || !draft.to}>Приложи</Button>
          </div>
        </form>

        <CardContent className="p-0">
          {q.isLoading ? <TableSkeleton rows={8} cols={5} />
            : q.isError ? <div className="p-5"><ErrorState onRetry={() => q.refetch()} /></div>
            : entries.length === 0 ? <EmptyState icon={BookOpenCheck} title="Няма осчетоводени записи" description="Одобрете и осчетоводете документ от „Преглед“, за да се появи тук." />
            : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Запис №</TableHead>
                    <TableHead>Описание / сметка</TableHead>
                    <TableHead className="num">Дебит</TableHead>
                    <TableHead className="num">Кредит</TableHead>
                    <TableHead className="w-36 text-right">Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => {
                    const lines = e.lines ?? [];
                    const totalDr = lines.filter((l) => l.direction === 'debit').reduce((s, l) => s + toNumber(l.amount), 0);
                    const totalCr = lines.filter((l) => l.direction === 'credit').reduce((s, l) => s + toNumber(l.amount), 0);
                    return (
                      <React.Fragment key={String(e.entryNo)}>
                        <TableRow className="border-0 bg-surface-2/40 hover:bg-surface-2/40">
                          <TableCell className="font-mono text-xs font-medium text-foreground">№{e.entryNo}</TableCell>
                          <TableCell>
                            <span className="font-medium text-foreground">{e.description ?? 'Журнал'}</span>
                            <span className="ml-2 t-caption">{dateBG(e.date)} · източник: {e.sourceType ?? '—'}</span>
                          </TableCell>
                          <TableCell className="num"><Money value={totalDr} strong /></TableCell>
                          <TableCell className="num"><Money value={totalCr} strong /></TableCell>
                          <TableCell className="text-right"><Badge variant="success" dot>Осчетоводен</Badge></TableCell>
                        </TableRow>
                        {lines.map((l, i) => (
                          <TableRow key={`${e.entryNo}-${i}`} className={i === lines.length - 1 ? 'border-b border-border' : 'border-0'}>
                            <TableCell className="h-9 py-1" />
                            <TableCell className="h-9 py-1">
                              <span className="font-mono text-xs text-foreground">{l.accountCode}</span>
                              {l.accountName && <span className="ml-2 text-muted-foreground">{l.accountName}</span>}
                            </TableCell>
                            <TableCell className="num h-9 py-1">{l.direction === 'debit' ? <Money value={l.amount} /> : <span className="text-faint">—</span>}</TableCell>
                            <TableCell className="num h-9 py-1">{l.direction === 'credit' ? <Money value={l.amount} /> : <span className="text-faint">—</span>}</TableCell>
                            <TableCell className="h-9 py-1" />
                          </TableRow>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
        </CardContent>
        {entries.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-[13px] text-muted-foreground">
            <span><span className="tabular-nums text-foreground">{entries.length}</span> записа · {dateBG(range.from)} – {dateBG(range.to)}</span>
          </div>
        )}
      </Card>
    </div>
  );
}
