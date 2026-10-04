'use client';

import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert, ShieldX, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { Notice } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { dateTimeBG } from '@/lib/format';
import type { AuditChainStatus } from '@/lib/api/types';

const META: Record<AuditChainStatus, { label: string; desc: string; icon: typeof ShieldCheck; tone: 'success' | 'warning' | 'destructive' }> = {
  verified: { label: 'Проверено', desc: 'Веригата на одита е цяла и непроменена.', icon: ShieldCheck, tone: 'success' },
  warning: { label: 'Внимание', desc: 'Все още няма записи в одитната верига.', icon: ShieldAlert, tone: 'warning' },
  failed: { label: 'Нарушено', desc: 'Открито е несъответствие в одитната верига.', icon: ShieldX, tone: 'destructive' },
};

/**
 * Audit Integrity Status — surfaces the server-side hash-chain verification
 * (`verify_audit_chain()`), as Verified / Warning / Failed. Read-only.
 */
export function AuditIntegrityStatus({ compact = false }: { compact?: boolean }) {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const q = useQuery({
    queryKey: ['audit', 'verify', companyId],
    queryFn: () => Endpoints.auditVerify(),
    enabled: !!companyId,
  });

  if (q.isLoading) {
    return (
      <Notice tone="neutral" icon={Loader2} className="[&_svg]:animate-spin">
        Проверка на интегритета на одитната верига…
      </Notice>
    );
  }
  const v = q.data;
  const m = META[v?.status ?? 'warning'];

  return (
    <Notice
      tone={m.tone}
      icon={m.icon}
      title={<span className="inline-flex flex-wrap items-center gap-2">Интегритет на одита <Badge variant={m.tone} dot>{m.label}</Badge></span>}
      action={v && !compact ? (
        <dl className="hidden text-right text-xs sm:block">
          <dt className="t-overline">Записи</dt>
          <dd className="font-mono tabular-nums text-foreground">{v.events}</dd>
        </dl>
      ) : undefined}
    >
      {!compact && (
        <>
          {m.desc}
          {v ? <span className="tabular-nums"> Проверено на {dateTimeBG(v.checkedAt)}.</span> : null}
        </>
      )}
    </Notice>
  );
}
