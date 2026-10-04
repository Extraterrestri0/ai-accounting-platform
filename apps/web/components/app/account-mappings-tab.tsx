'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { useLang } from '@/lib/i18n';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, TableSkeleton } from '@/components/app/states';

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
        <CardTitle>{t('Счетоводни сметки', 'Accounting accounts')}</CardTitle>
        <CardDescription>
          {t('Сметките, които системата предлага при осчетоводяване на фактури и покупки. Всяко предложение се одобрява ръчно.',
             'The accounts the system proposes when posting invoices and purchases. Every proposal is approved by a person.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : accounts.length === 0 ? (
          <EmptyState
            compact
            icon={SlidersHorizontal}
            title={t('Няма сметки в сметкоплана', 'No accounts in the chart of accounts')}
            description={t('Първо добавете сметки, за да ги свържете с роли.', 'Add accounts first to map them to roles.')}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Роля', 'Role')}</TableHead>
                  <TableHead className="w-[45%] min-w-[16rem]">{t('Сметка', 'Account')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROLES.map((r) => {
                  const current = (mapQ.data as Mapping[] | undefined)?.find((m) => m.role === r.role);
                  const id = `map-${r.role}`;
                  return (
                    <TableRow key={r.role} className="hover:bg-transparent">
                      <TableCell className="py-3 align-top">
                        <label htmlFor={id} className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                          {t(r.bg, r.en)}
                          {current?.isDefault && <Badge variant="neutral">{t('по подразбиране', 'default')}</Badge>}
                        </label>
                        <p className="t-caption mt-0.5">{t(r.hintBg, r.hintEn)}</p>
                      </TableCell>
                      <TableCell className="py-3 align-top">
                        <Select
                          id={id}
                          value={draft[r.role] ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, [r.role]: e.target.value }))}
                          aria-invalid={!draft[r.role] || undefined}
                        >
                          <option value="" disabled>{t('— изберете сметка —', '— select account —')}</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                          ))}
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <CardFooter className="justify-between gap-3">
              <p className={cn('text-[13px]', incomplete ? 'text-warning' : 'text-muted-foreground')}>
                {incomplete ? t('Изберете сметка за всяка роля.', 'Pick an account for every role.') : t('Всички роли са свързани.', 'All roles are mapped.')}
              </p>
              <Button onClick={() => save.mutate()} disabled={save.isPending || incomplete}>
                {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} {t('Запази', 'Save')}
              </Button>
            </CardFooter>
          </>
        )}
      </CardContent>
    </Card>
  );
}
