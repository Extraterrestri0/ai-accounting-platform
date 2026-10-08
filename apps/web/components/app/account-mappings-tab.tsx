'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, SlidersHorizontal, Save } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { useLang } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type Mapping = { role: string; accountId: string | null; code: string; accountName: string | null; isDefault: boolean };
type AccountNode = { id: string; code: string; name: string; isPostable?: boolean; children?: AccountNode[] };

/** Display order + bilingual labels for the closed set of posting roles. */
const ROLES: Array<{ role: string; bg: string; en: string; hintBg: string; hintEn: string }> = [
  { role: 'sales_revenue',            bg: 'Приходи от продажби',          en: 'Sales revenue',         hintBg: 'Кредитира се при издаване на фактура',     hintEn: 'Credited when an invoice is issued' },
  { role: 'sales_vat_output',         bg: 'Начислен ДДС (продажби)',      en: 'Output VAT (sales)',    hintBg: 'Задължение по ДДС от продажби',            hintEn: 'VAT liability from sales' },
  { role: 'receivable',               bg: 'Вземания от клиенти',          en: 'Customer receivables',  hintBg: 'Дебитира се с брутната сума',              hintEn: 'Debited with the gross amount' },
  { role: 'purchase_expense_default', bg: 'Разход по подразбиране',       en: 'Default expense',       hintBg: 'Когато няма правило/история за доставчика', hintEn: 'When no supplier rule/history applies' },
  { role: 'purchase_vat_input',       bg: 'Данъчен кредит ДДС (покупки)', en: 'Input VAT (purchases)', hintBg: 'Приспадаемо ДДС от покупки',               hintEn: 'Deductible VAT from purchases' },
  { role: 'payable',                  bg: 'Задължения към доставчици',    en: 'Supplier payables',     hintBg: 'Кредитира се с брутната сума',             hintEn: 'Credited with the gross amount' },
];

/** Flatten the chart-of-accounts tree returned by GET /accounts into postable leaves. */
function flattenPostable(nodes: AccountNode[] | undefined): AccountNode[] {
  const out: AccountNode[] = [];
  const walk = (list: AccountNode[]) => {
    for (const n of list) {
      if (n.isPostable !== false) out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes ?? []);
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

export function AccountMappingsTab() {
  const { activeCompany } = useAuth();
  const { lang } = useLang();
  const qc = useQueryClient();
  const companyId = activeCompany?.id;
  const t = (bg: string, en: string) => (lang === 'bg' ? bg : en);

  const mapQ = useQuery({ queryKey: ['account-mappings', companyId], queryFn: () => Endpoints.accountMappings(companyId!), enabled: !!companyId });
  const accQ = useQuery({ queryKey: ['accounts'], queryFn: () => Endpoints.accounts(), enabled: !!companyId });

  const accounts = React.useMemo(() => flattenPostable(accQ.data as AccountNode[] | undefined), [accQ.data]);

  // Local draft of role → accountId, initialised from the server mapping (or the default code's account).
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (!mapQ.data) return;
    const next: Record<string, string> = {};
    for (const m of mapQ.data as Mapping[]) {
      next[m.role] = m.accountId ?? accounts.find((a) => a.code === m.code)?.id ?? '';
    }
    setDraft(next);
  }, [mapQ.data, accounts]);

  const save = useMutation({
    mutationFn: () => Endpoints.updateAccountMappings(
      companyId!, ROLES.filter((r) => draft[r.role]).map((r) => ({ role: r.role, accountId: draft[r.role] })),
    ),
    onSuccess: () => { toast.success(t('Сметките са запазени', 'Accounts saved')); qc.invalidateQueries({ queryKey: ['account-mappings', companyId] }); },
    onError: (e) => toast.error(t('Грешка при запис', 'Save failed'), { description: e instanceof ApiError ? e.message : '' }),
  });

  const loading = mapQ.isLoading || accQ.isLoading;
  const incomplete = ROLES.some((r) => !draft[r.role]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" /> {t('Счетоводни сметки', 'Accounting accounts')}
        </CardTitle>
        <CardDescription>
          {t('Сметките, които системата използва при автоматичното осчетоводяване на фактури и покупки.',
             'The accounts the system uses when auto-posting invoices and purchases.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('Зареждане…', 'Loading…')}
          </div>
        ) : accounts.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            {t('Няма сметки в сметкоплана. Първо добавете сметки.', 'No accounts in the chart of accounts yet.')}
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {ROLES.map((r) => {
                const current = (mapQ.data as Mapping[] | undefined)?.find((m) => m.role === r.role);
                return (
                  <div key={r.role} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">{t(r.bg, r.en)}</Label>
                      {current?.isDefault && <Badge variant="neutral">{t('по подразбиране', 'default')}</Badge>}
                    </div>
                    <select
                      value={draft[r.role] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.role]: e.target.value }))}
                      className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
                    >
                      <option value="" disabled>{t('— изберете сметка —', '— select account —')}</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">{t(r.hintBg, r.hintEn)}</p>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                {incomplete ? t('Изберете сметка за всяка роля.', 'Pick an account for every role.') : ''}
              </p>
              <Button onClick={() => save.mutate()} disabled={save.isPending || incomplete}>
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('Запази', 'Save')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
