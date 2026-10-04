'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, Plus, Loader2, LogOut, Camera, Trash2, Globe, History } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Segmented } from '@/components/ui/segmented';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/app/states';
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
          <TabsTrigger value="accounts">{lang === 'bg' ? 'Сметки / мапинг' : 'Accounts'}</TabsTrigger>
          <TabsTrigger value="periods">{lang === 'bg' ? 'Периоди' : 'Periods'}</TabsTrigger>
          <TabsTrigger value="profile">{t('settings.tabProfile')}</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.currentCompany')}</CardTitle>
              <CardDescription>{lang === 'bg' ? 'Основни данни на активната фирма.' : 'Core details of the active company.'}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <dl className="grid border-t border-border sm:grid-cols-2">
                <Field label={t('settings.name')} value={activeCompany?.name} />
                <Field label={t('settings.eik')} value={activeCompany?.eik ?? '—'} mono />
                <Field label={t('settings.vatStatus')} value={activeCompany?.vatStatus ?? '—'} capitalize />
                <Field label={t('settings.currency')} value={activeCompany?.baseCurrency ?? 'EUR'} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="counterparties">
          <Card>
            <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{t('settings.counterparties')}</CardTitle>
                <CardDescription className="mt-0.5">{t('settings.counterpartiesSub')}</CardDescription>
              </div>
              <Button size="sm" onClick={() => setAddOpen(true)}><Plus /> {t('common.add')}</Button>
            </div>
            <CardContent className="p-0">
              {!cpQ.data || cpQ.data.length === 0 ? (
                <EmptyState
                  compact
                  icon={Users}
                  title={t('settings.noCounterparties')}
                  action={<Button size="sm" variant="outline" onClick={() => setAddOpen(true)}><Plus /> {t('settings.addCounterparty')}</Button>}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('settings.name')}</TableHead>
                      <TableHead>{t('settings.eik')}</TableHead>
                      <TableHead>{t('settings.type')}</TableHead>
                      <TableHead>VIES</TableHead>
                      <TableHead className="w-12"><span className="sr-only">{t('common.actions')}</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cpQ.data.map((c: any) => (
                      <TableRow key={c.id} className="group">
                        <TableCell className="font-medium text-foreground">
                          <span className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-[11px] font-semibold text-brand">{initials(c.name)}</span>
                            <span className="truncate">{c.name}</span>
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{c.eik ?? c.vatNumber ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="neutral">{c.kind === 'customer' ? t('settings.customer') : c.kind === 'supplier' ? t('settings.supplier') : c.kind}</Badge>
                        </TableCell>
                        <TableCell><ViesStatusBadge counterpartyId={c.id} showRefresh /></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100" title="Одитна история" aria-label="Одитна история" onClick={() => setCpAuditFor(c.id)}><History /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
      <CardHeader>
        <CardTitle>{t('profile.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-border">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
            <AvatarFallback className="text-lg">{initials((email || 'U').split('@')[0])}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="font-medium text-foreground">{email.split('@')[0]}</p>
            <p className="text-sm text-muted-foreground">{email}</p>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? <Loader2 className="animate-spin" /> : <Camera />} {t('profile.uploadPhoto')}
              </Button>
              {user?.avatarUrl && (
                <Button size="sm" variant="ghost" disabled={busy} className="text-destructive" onClick={onRemove}>
                  <Trash2 /> {t('profile.removePhoto')}
                </Button>
              )}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
                onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            <p className="t-caption">{t('profile.photoHint')}</p>
          </div>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-muted-foreground" /> {t('profile.language')}</Label>
          <Segmented<Lang>
            size="md"
            value={lang}
            onChange={setLang}
            options={[
              { value: 'bg', label: t('profile.languageBg') },
              { value: 'en', label: t('profile.languageEn') },
            ]}
          />
        </div>

        <div className="border-t border-border pt-5">
          <Button variant="outline" onClick={async () => { await logout(); router.replace('/login'); }} className="text-destructive">
            <LogOut /> {t('profile.logout')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, mono, capitalize }: { label: string; value?: string; mono?: boolean; capitalize?: boolean }) {
  return (
    <div className="border-b border-border px-5 py-3.5 [&:last-child]:border-b-0 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0">
      <dt className="t-overline">{label}</dt>
      <dd className={cn('mt-1 text-sm font-medium text-foreground', mono && 'font-mono tabular-nums', capitalize && 'capitalize')}>{value ?? '—'}</dd>
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
        <DialogHeader>
          <DialogTitle>{t('settings.addCounterparty')}</DialogTitle>
          <DialogDescription>{t('settings.counterpartiesSub')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="cp-kind">{t('settings.type')}</Label>
            <Select id="cp-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="customer">{t('settings.customer')}</option><option value="supplier">{t('settings.supplier')}</option>
            </Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="cp-name">{t('settings.name')}</Label><Input id="cp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Фирма ЕООД" /></div>
          <div className="space-y-1.5"><Label htmlFor="cp-eik">{t('settings.eikOptional')}</Label><Input id="cp-eik" value={eik} onChange={(e) => setEik(e.target.value)} placeholder="203912837" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !name}>{create.isPending ? <Loader2 className="animate-spin" /> : null} {t('common.add')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
