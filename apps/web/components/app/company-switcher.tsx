'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError, setActiveCompany } from '@/lib/api/client';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CompanySwitcher() {
  const { companies, activeCompany, selectCompany, reloadCompanies } = useAuth();
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);

  const choose = (id: string) => {
    selectCompany(id);
    // refetch company-scoped data on the current route
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg border bg-card px-2.5 py-1.5 text-left text-sm shadow-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-soft text-xs font-semibold text-accent-foreground">
          {activeCompany ? initials(activeCompany.name) : <Building2 className="h-4 w-4" />}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-[10rem] truncate font-medium leading-tight">{activeCompany?.name ?? 'Изберете фирма'}</span>
          <span className="block text-[11px] leading-tight text-muted-foreground">{activeCompany?.eik ? `ЕИК ${activeCompany.eik}` : 'Няма избрана фирма'}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Фирми</DropdownMenuLabel>
        {companies.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">Няма налични фирми</p>}
        {companies.map((c) => (
          <DropdownMenuItem key={c.id} onClick={() => choose(c.id)} className="gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-soft text-xs font-semibold text-accent-foreground">
              {initials(c.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium leading-tight text-foreground">{c.name}</span>
              <span className="block text-[11px] leading-tight text-muted-foreground">{c.baseCurrency}{c.eik ? ` · ЕИК ${c.eik}` : ''}</span>
            </span>
            <Check className={cn('h-4 w-4 text-primary', activeCompany?.id === c.id ? 'opacity-100' : 'opacity-0')} />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Нова фирма
        </DropdownMenuItem>
      </DropdownMenuContent>

      <CreateCompanyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async (id) => {
          setActiveCompany(id);
          await reloadCompanies();
          selectCompany(id);
          router.refresh();
        }}
      />
    </DropdownMenu>
  );
}

function CreateCompanyDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const [name, setName] = React.useState('');
  const [eik, setEik] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const c = await Endpoints.createCompany({ name: name.trim(), eik: eik.trim() || undefined });
      toast.success('Фирмата е създадена', { description: c.name });
      onCreated(c.id);
      onOpenChange(false);
      setName(''); setEik('');
    } catch (e) {
      toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Нова фирма</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Наименование</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Моята Фирма ЕООД" /></div>
          <div className="space-y-1.5"><Label>ЕИК (по избор)</Label><Input value={eik} onChange={(e) => setEik(e.target.value)} placeholder="203912837" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отказ</Button>
          <Button onClick={submit} disabled={submitting || !name.trim()}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Създай</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
