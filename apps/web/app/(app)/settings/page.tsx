'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Users, Plus, Loader2, UserCircle, LogOut, Camera, Trash2, Globe, History } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { useT, useLang, type Lang } from '@/lib/i18n';
import { fileToAvatarDataUrl } from '@/lib/image';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AccountMappingsTab } from '@/components/app/account-mappings-tab';
import { AccountingPeriodsTab } from '@/components/app/accounting-periods-tab';
import { ViesStatusBadge } from '@/components/app/vies-status';
import { AuditHistoryDialog } from '@/components/app/audit/audit-history-dialog';

export default function SettingsPage() {
  const { activeCompany } = useAuth();
  const t = useT();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = React.useState(false);
  const [cpAuditFor, setCpAuditFor] = React.useState<string | null>(null);

  const cpQ = useQuery({ queryKey: ['counterparties'], queryFn: () => Endpoints.counterparties().catch(() => []), enabled: !!activeCompany });

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">{t('settings.tabCompany')}</TabsTrigger>
          <TabsTrigger value="counterparties">{t('settings.tabCounterparties')}</TabsTrigger>
          <TabsTrigger value="accounts">{lang === 'bg' ? 'Сметки' : 'Accounts'}</TabsTrigger>
          <TabsTrigger value="periods">{lang === 'bg' ? 'Периоди' : 'Periods'}</TabsTrigger>
          <TabsTrigger value="profile">{t('settings.tabProfile')}</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-muted-foreground" /> {t('settings.currentCompany')}</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label={t('settings.name')} value={activeCompany?.name} />
              <Field label={t('settings.eik')} value={activeCompany?.eik ?? '—'} />
              <Field label={t('settings.vatStatus')} value={activeCompany?.vatStatus ?? '—'} />
              <Field label={t('settings.currency')} value={activeCompany?.baseCurrency ?? 'EUR'} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="counterparties">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-muted-foreground" /> {t('settings.counterparties')}</CardTitle>
                <CardDescription>{t('settings.counterpartiesSub')}</CardDescription>
              </div>
              <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> {t('common.add')}</Button>
            </CardHeader>
            <CardContent className="p-0">
              {!cpQ.data || cpQ.data.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">{t('settings.noCounterparties')}</p>
              ) : (
                <div className="divide-y">
                  {cpQ.data.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-xs font-semibold text-accent-foreground">{initials(c.name)}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.eik ? `${t('settings.eik')} ${c.eik}` : c.vatNumber ? `${t('dashboard.kpiVatPayable')} ${c.vatNumber}` : '—'}</p>
                      </div>
                      <Badge variant="neutral">{c.kind === 'customer' ? t('settings.customer') : c.kind === 'supplier' ? t('settings.supplier') : c.kind}</Badge>
                      <ViesStatusBadge counterpartyId={c.id} showRefresh />
                      <Button variant="ghost" size="icon" title="Одитна история" onClick={() => setCpAuditFor(c.id)}><History className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts"><AccountMappingsTab /></TabsContent>

        <TabsContent value="periods"><AccountingPeriodsTab /></TabsContent>

        <TabsContent value="profile"><ProfileTab /></TabsContent>
      </Tabs>

      <AddCounterpartyDialog open={addOpen} onOpenChange={setAddOpen} onAdded={() => qc.invalidateQueries({ queryKey: ['counterparties'] })} />
      <AuditHistoryDialog entityType="counterparty" entityId={cpAuditFor} subtitle="Хронология на промените по този контрагент." onOpenChange={(v) => !v && setCpAuditFor(null)} />
    </div>
  );
}

function ProfileTab() {
  const { user, setAvatar, logout } = useAuth();
  const t = useT();
  const { lang, setLang } = useLang();
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const email = user?.email ?? '';

  const onPick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      await setAvatar(dataUrl);
      toast.success(t('profile.photoSaved'));
    } catch (e) {
      toast.error(t('states.genericError'), { description: e instanceof ApiError ? e.message : t('profile.photoTooBig') });
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    setBusy(true);
    try { await setAvatar(null); toast.success(t('profile.photoRemoved')); }
    catch (e) { toast.error(t('states.genericError'), { description: e instanceof ApiError ? e.message : '' }); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserCircle className="h-4 w-4 text-muted-foreground" /> {t('profile.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
            <AvatarFallback className="text-lg">{initials((email || 'U').split('@')[0])}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="font-medium text-foreground">{email.split('@')[0]}</p>
            <p className="text-sm text-muted-foreground">{email}</p>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {t('profile.uploadPhoto')}
              </Button>
              {user?.avatarUrl && (
                <Button size="sm" variant="ghost" disabled={busy} className="text-destructive" onClick={onRemove}>
                  <Trash2 className="h-4 w-4" /> {t('profile.removePhoto')}
                </Button>
              )}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
                onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            <p className="text-xs text-muted-foreground">{t('profile.photoHint')}</p>
          </div>
        </div>

        {/* Language */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> {t('profile.language')}</Label>
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(['bg', 'en'] as Lang[]).map((l) => (
              <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
                className={cn('rounded px-3 py-1 text-sm font-medium transition-colors',
                  lang === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {l === 'bg' ? t('profile.languageBg') : t('profile.languageEn')}
              </button>
            ))}
          </div>
        </div>

        <Button variant="outline" onClick={async () => { await logout(); router.replace('/login'); }} className="text-destructive">
          <LogOut className="h-4 w-4" /> {t('profile.logout')}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium capitalize text-foreground">{value ?? '—'}</p>
    </div>
  );
}

function AddCounterpartyDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const t = useT();
  const [name, setName] = React.useState('');
  const [eik, setEik] = React.useState('');
  const [kind, setKind] = React.useState('customer');
  const create = useMutation({
    mutationFn: () => Endpoints.createCounterparty({ kind, name, eik: eik || undefined }),
    onSuccess: () => { toast.success(t('common.add')); onAdded(); onOpenChange(false); setName(''); setEik(''); },
    onError: (e) => toast.error(t('states.genericError'), { description: e instanceof ApiError ? e.message : '' }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('settings.addCounterparty')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>{t('settings.type')}</Label>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="customer">{t('settings.customer')}</option><option value="supplier">{t('settings.supplier')}</option>
            </select>
          </div>
          <div className="space-y-1.5"><Label>{t('settings.name')}</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Фирма ЕООД" /></div>
          <div className="space-y-1.5"><Label>{t('settings.eikOptional')}</Label><Input value={eik} onChange={(e) => setEik(e.target.value)} placeholder="203912837" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !name}>{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t('common.add')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
