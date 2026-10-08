'use client';

import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert, ShieldX, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { cn } from '@/lib/utils';
import { dateTimeBG } from '@/lib/format';
import type { AuditChainStatus } from '@/lib/api/types';

const META: Record<AuditChainStatus, { label: string; desc: string; icon: typeof ShieldCheck; cls: string }> = {
  verified: { label: 'Проверено', desc: 'Веригата на одита е цяла и непроменена.', icon: ShieldCheck, cls: 'border-success/30 bg-success-soft text-success' },
  warning: { label: 'Внимание', desc: 'Все още няма записи в одитната верига.', icon: ShieldAlert, cls: 'border-warning/30 bg-warning-soft text-warning' },
  failed: { label: 'Нарушено', desc: 'Открито е несъответствие в одитната верига.', icon: ShieldX, cls: 'border-destructive/30 bg-destructive-soft text-destructive' },
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
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Проверка на интегритета…
      </div>
    );
  }
  const v = q.data;
  const m = META[v?.status ?? 'warning'];
  const Icon = m.icon;

  return (
    <div className={cn('flex items-center gap-3 rounded-lg border px-4 py-3', m.cls)}>
      <Icon className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Интегритет на одита: {m.label}</p>
        {!compact && (
          <p className="text-xs opacity-90">
            {m.desc}
            {v ? ` · ${v.events} записа · проверено ${dateTimeBG(v.checkedAt)}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
