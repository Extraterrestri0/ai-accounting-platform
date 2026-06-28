'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PackageSearch, Plus, Loader2, Pencil } from 'lucide-react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

interface CatalogItem {
  id: string; code: string; description: string; kind: 'product' | 'service'; unit: string; vatRate: string;
  vatCodeId?: string; saftCode?: string; defaultAccountId?: string; defaultAccountCode?: string; vatCodeLabel?: string; isActive: boolean;
}
interface AccountNode { id: string; code: string; name: string; isPostable?: boolean; children?: AccountNode[] }

const selectCls = 'h-11 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15';

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

  const listQ = useQuery({ queryKey: ['catalog'], queryFn: () => Endpoints.catalogItems(), enabled: !!activeCompany });
  const items: CatalogItem[] = listQ.data ?? [];

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (it: CatalogItem) => { setEditing(it); setOpen(true); };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Каталог', 'Catalog')}
        description={t('Продукти и услуги за многократна употреба във фактури.', 'Reusable products and services for invoices.')}
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> {t('Нов артикул', 'New item')}</Button>}
      />

      <Card>
        {listQ.isLoading ? (
          <div className="p-4"><TableSkeleton rows={6} cols={6} /></div>
        ) : listQ.isError ? (
          <div className="p-6"><ErrorState onRetry={() => listQ.refetch()} /></div>
        ) : items.length === 0 ? (
          <div className="p-6"><EmptyState icon={PackageSearch} title={t('Няма артикули', 'No items')} description={t('Създайте първия продукт или услуга.', 'Create your first product or service.')} action={<Button onClick={openNew}><Plus className="h-4 w-4" /> {t('Нов артикул', 'New item')}</Button>} /></div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{t('Код', 'Code')}</TableHead>
              <TableHead>{t('Описание', 'Description')}</TableHead>
              <TableHead>{t('Вид', 'Kind')}</TableHead>
              <TableHead>{t('Мярка', 'Unit')}</TableHead>
              <TableHead className="text-right">{t('ДДС %', 'VAT %')}</TableHead>
              <TableHead>{t('SAF-T', 'SAF-T')}</TableHead>
              <TableHead>{t('Сметка', 'Account')}</TableHead>
              <TableHead className="text-right">{t('Действие', 'Action')}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id} className={it.isActive ? '' : 'opacity-55'}>
                  <TableCell className="font-medium text-foreground">{it.code}</TableCell>
                  <TableCell>{it.description}</TableCell>
                  <TableCell><Badge variant={it.kind === 'product' ? 'default' : 'neutral'}>{it.kind === 'product' ? t('Продукт', 'Product') : t('Услуга', 'Service')}</Badge></TableCell>
                  <TableCell>{it.unit}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(it.vatRate).toFixed(0)}%</TableCell>
                  <TableCell className="font-mono text-xs">{it.saftCode ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{it.defaultAccountCode ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(it)}><Pencil className="h-4 w-4" /> {t('Редактирай', 'Edit')}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>{t('Код', 'Code')}</Label><Input value={form.code} onChange={(e) => set({ code: e.target.value })} placeholder="PRD001" /></div>
          <div className="space-y-1.5"><Label>{t('Вид', 'Kind')}</Label>
            <select className={selectCls} value={form.kind} onChange={(e) => set({ kind: e.target.value })}>
              <option value="service">{t('Услуга', 'Service')}</option><option value="product">{t('Продукт', 'Product')}</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label>{t('Описание', 'Description')}</Label><Input value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder={t('Счетоводна услуга', 'Accounting service')} /></div>
          <div className="space-y-1.5"><Label>{t('Мярка', 'Unit')}</Label><Input value={form.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="pcs" /></div>
          <div className="space-y-1.5"><Label>{t('ДДС ставка %', 'VAT rate %')}</Label><Input value={form.vatRate} onChange={(e) => set({ vatRate: e.target.value })} placeholder="20" /></div>
          <div className="space-y-1.5"><Label>{t('SAF-T код', 'SAF-T code')}</Label><Input value={form.saftCode} onChange={(e) => set({ saftCode: e.target.value })} placeholder="SVC001" /></div>
          <div className="space-y-1.5"><Label>{t('ДДС код', 'VAT code')}</Label>
            <select className={selectCls} value={form.vatCodeId} onChange={(e) => set({ vatCodeId: e.target.value })}>
              <option value="">{t('— няма —', '— none —')}</option>
              {(vatQ.data ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.code} · {v.description}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label>{t('Сметка по подразбиране', 'Default account')}</Label>
            <select className={selectCls} value={form.defaultAccountId} onChange={(e) => set({ defaultAccountId: e.target.value })}>
              <option value="">{t('— няма —', '— none —')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
            </select>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> {t('Активен', 'Active')}
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Отказ', 'Cancel')}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !valid}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t('Запази', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
