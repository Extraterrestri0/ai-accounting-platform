'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PackageSearch, Plus, Loader2, Pencil, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useLang } from '@/lib/i18n';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Segmented } from '@/components/ui/segmented';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface CatalogItem {
  id: string; code: string; description: string; kind: 'product' | 'service'; unit: string; vatRate: string;
  vatCodeId?: string; saftCode?: string; defaultAccountId?: string; defaultAccountCode?: string; vatCodeLabel?: string; isActive: boolean;
}
interface AccountNode { id: string; code: string; name: string; isPostable?: boolean; children?: AccountNode[] }

type KindFilter = 'all' | 'product' | 'service';
const PAGE_SIZE = 25;

function flattenPostable(nodes: AccountNode[] | undefined): AccountNode[] {
  const out: AccountNode[] = [];
  const walk = (list: AccountNode[]) => list.forEach((n) => { if (n.isPostable !== false) out.push(n); if (n.children?.length) walk(n.children); });
  walk(nodes ?? []);
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

export default function CatalogPage() {
  const { activeCompany } = useAuth();
  const { lang } = useLang();
  const t = (bg: string, en: string) => (lang === 'bg' ? bg : en);
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CatalogItem | null>(null);

  const [search, setSearch] = React.useState('');
  const [kind, setKind] = React.useState<KindFilter>('all');
  const [showInactive, setShowInactive] = React.useState(true);
  const [page, setPage] = React.useState(1);

  const listQ = useQuery({ queryKey: ['catalog'], queryFn: () => Endpoints.catalogItems(), enabled: !!activeCompany });
  const items = React.useMemo<CatalogItem[]>(() => listQ.data ?? [], [listQ.data]);

  // Client-side filtering only (the list endpoint is unchanged).
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) =>
      (kind === 'all' || it.kind === kind)
      && (showInactive || it.isActive)
      && (!q || it.code.toLowerCase().includes(q) || it.description.toLowerCase().includes(q) || (it.saftCode ?? '').toLowerCase().includes(q)),
    );
  }, [items, search, kind, showInactive]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const resetPage = () => setPage(1);
  const counts = React.useMemo(() => ({
    all: items.length, product: items.filter((i) => i.kind === 'product').length, service: items.filter((i) => i.kind === 'service').length,
  }), [items]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (it: CatalogItem) => { setEditing(it); setOpen(true); };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Каталог', 'Catalog')}
        description={t('Продукти и услуги за многократна употреба във фактури.', 'Reusable products and services for invoices.')}
        actions={<Button onClick={openNew}><Plus /> {t('Нов артикул', 'New item')}</Button>}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={kind}
              onChange={(v) => { setKind(v); resetPage(); }}
              options={[
                { value: 'all', label: t('Всички', 'All'), count: counts.all },
                { value: 'product', label: t('Продукти', 'Products'), count: counts.product },
                { value: 'service', label: t('Услуги', 'Services'), count: counts.service },
              ]}
            />
            <Segmented
              value={showInactive ? 'all' : 'active'}
              onChange={(v) => { setShowInactive(v === 'all'); resetPage(); }}
              options={[
                { value: 'active', label: t('Само активни', 'Active only') },
                { value: 'all', label: t('Вкл. неактивни', 'Incl. inactive') },
              ]}
            />
          </div>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input className="pl-9" placeholder={t('Търси по код или описание', 'Search by code or description')} value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} />
          </div>
        </div>

        {listQ.isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : listQ.isError ? (
          <div className="p-6"><ErrorState onRetry={() => listQ.refetch()} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={PackageSearch} title={t('Няма артикули', 'No items')} description={t('Създайте първия продукт или услуга.', 'Create your first product or service.')} action={<Button onClick={openNew}><Plus /> {t('Нов артикул', 'New item')}</Button>} />
        ) : filtered.length === 0 ? (
          <EmptyState compact icon={Search} title={t('Няма съвпадения', 'No matches')} description={t('Променете търсенето или филтрите.', 'Adjust the search or filters.')} action={<Button variant="outline" size="sm" onClick={() => { setSearch(''); setKind('all'); setShowInactive(true); resetPage(); }}>{t('Изчисти филтрите', 'Clear filters')}</Button>} />
        ) : (
          <>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t('Код', 'Code')}</TableHead>
                <TableHead>{t('Описание', 'Description')}</TableHead>
                <TableHead>{t('Вид', 'Kind')}</TableHead>
                <TableHead>{t('Мярка', 'Unit')}</TableHead>
                <TableHead className="num">{t('ДДС %', 'VAT %')}</TableHead>
                <TableHead>SAF-T</TableHead>
                <TableHead>{t('Сметка', 'Account')}</TableHead>
                <TableHead className="text-right">{t('Действие', 'Action')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {pageRows.map((it) => (
                  <TableRow key={it.id} className={cn('cursor-pointer', !it.isActive && 'text-muted-foreground')} onClick={() => openEdit(it)}>
                    <TableCell className="whitespace-nowrap font-medium text-foreground">
                      <span className={cn(!it.isActive && 'text-muted-foreground')}>{it.code}</span>
                      {!it.isActive && <Badge variant="outline" className="ml-2">{t('Неактивен', 'Inactive')}</Badge>}
                    </TableCell>
                    <TableCell className="max-w-[20rem] truncate">{it.description}</TableCell>
                    <TableCell><Badge variant={it.kind === 'product' ? 'brand' : 'neutral'}>{it.kind === 'product' ? t('Продукт', 'Product') : t('Услуга', 'Service')}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{it.unit}</TableCell>
                    <TableCell className="num">{Number(it.vatRate).toFixed(0)}%</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{it.saftCode ?? '—'}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{it.defaultAccountCode ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(it); }}><Pencil /> {t('Редактирай', 'Edit')}</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length > PAGE_SIZE && (
              <Pagination page={safePage} totalPages={totalPages} total={filtered.length} unit={t('артикула', 'items')} onChange={setPage} />
            )}
          </>
        )}
      </Card>

      <CatalogDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => qc.invalidateQueries({ queryKey: ['catalog'] })} />
    </div>
  );
}

function CatalogDialog({ open, onOpenChange, editing, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; editing: CatalogItem | null; onSaved: () => void }) {
  const { lang } = useLang();
  const t = (bg: string, en: string) => (lang === 'bg' ? bg : en);
  const accQ = useQuery({ queryKey: ['accounts'], queryFn: () => Endpoints.accounts(), enabled: open });
  const vatQ = useQuery({ queryKey: ['vatCodes'], queryFn: () => Endpoints.vatCodes().catch(() => []), enabled: open });
  const accounts = React.useMemo(() => flattenPostable(accQ.data as AccountNode[] | undefined), [accQ.data]);

  const [form, setForm] = React.useState({ code: '', description: '', kind: 'service', unit: 'pcs', vatRate: '20', saftCode: '', defaultAccountId: '', vatCodeId: '', isActive: true });
  React.useEffect(() => {
    if (!open) return;
    setForm(editing
      ? { code: editing.code, description: editing.description, kind: editing.kind, unit: editing.unit, vatRate: String(editing.vatRate), saftCode: editing.saftCode ?? '', defaultAccountId: editing.defaultAccountId ?? '', vatCodeId: editing.vatCodeId ?? '', isActive: editing.isActive }
      : { code: '', description: '', kind: 'service', unit: 'pcs', vatRate: '20', saftCode: '', defaultAccountId: '', vatCodeId: '', isActive: true });
  }, [open, editing]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, defaultAccountId: form.defaultAccountId || null, vatCodeId: form.vatCodeId || null, saftCode: form.saftCode || null };
      return editing ? Endpoints.updateCatalogItem(editing.id, body) : Endpoints.createCatalogItem(body);
    },
    onSuccess: () => { toast.success(editing ? t('Запазено', 'Saved') : t('Артикулът е създаден', 'Item created')); onSaved(); onOpenChange(false); },
    onError: (e) => toast.error(t('Грешка', 'Error'), { description: e instanceof ApiError ? e.message : '' }),
  });

  const valid = form.code.trim() && form.description.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t('Редактиране на артикул', 'Edit item') : t('Нов артикул', 'New item')}</DialogTitle>
          <DialogDescription>{t('Код, описание, мярка, ДДС, SAF-T код и сметка по подразбиране.', 'Code, description, unit, VAT, SAF-T code and default account.')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="cat-code">{t('Код', 'Code')}</Label><Input id="cat-code" value={form.code} onChange={(e) => set({ code: e.target.value })} placeholder="PRD001" /></div>
          <div className="space-y-1.5"><Label htmlFor="cat-kind">{t('Вид', 'Kind')}</Label>
            <Select id="cat-kind" value={form.kind} onChange={(e) => set({ kind: e.target.value })}>
              <option value="service">{t('Услуга', 'Service')}</option><option value="product">{t('Продукт', 'Product')}</option>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cat-desc">{t('Описание', 'Description')}</Label><Input id="cat-desc" value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder={t('Счетоводна услуга', 'Accounting service')} /></div>
          <div className="space-y-1.5"><Label htmlFor="cat-unit">{t('Мярка', 'Unit')}</Label><Input id="cat-unit" value={form.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="pcs" /></div>
          <div className="space-y-1.5"><Label htmlFor="cat-vat">{t('ДДС ставка %', 'VAT rate %')}</Label><Input id="cat-vat" inputMode="decimal" className="tabular-nums" value={form.vatRate} onChange={(e) => set({ vatRate: e.target.value })} placeholder="20" /></div>
          <div className="space-y-1.5"><Label htmlFor="cat-saft">{t('SAF-T код', 'SAF-T code')}</Label><Input id="cat-saft" value={form.saftCode} onChange={(e) => set({ saftCode: e.target.value })} placeholder="SVC001" /></div>
          <div className="space-y-1.5"><Label htmlFor="cat-vatcode">{t('ДДС код', 'VAT code')}</Label>
            <Select id="cat-vatcode" value={form.vatCodeId} onChange={(e) => set({ vatCodeId: e.target.value })}>
              <option value="">{t('Няма', 'None')}</option>
              {(vatQ.data ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.code} · {v.description}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cat-account">{t('Сметка по подразбиране', 'Default account')}</Label>
            <Select id="cat-account" value={form.defaultAccountId} onChange={(e) => set({ defaultAccountId: e.target.value })}>
              <option value="">{t('Няма', 'None')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
            </Select>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
              <input type="checkbox" className="h-4 w-4 rounded border-input accent-[hsl(var(--brand))]" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> {t('Активен артикул', 'Active item')}
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Отказ', 'Cancel')}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !valid}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null} {t('Запази', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
