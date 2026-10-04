'use client';

import { useQuery } from '@tanstack/react-query';
import { Lock, LockOpen } from 'lucide-react';
import { Endpoints } from '@/lib/api/endpoints';
import { StatCard } from '@/components/app/stat-card';
import { periodLabel } from '@/components/app/accounting-periods-tab';

/** Dashboard KPI: the current accounting period and its lock status (Task 4.3). Links to Settings → Периоди. */
export function CurrentPeriodWidget({ companyId }: { companyId?: string }) {
  const q = useQuery({
    queryKey: ['period', 'current', companyId],
    queryFn: () => Endpoints.currentPeriod(),
    enabled: !!companyId,
  });
  const p = q.data;
  const locked = p?.status === 'locked';
  return (
    <StatCard
      label="Счетоводен период"
      value={p ? periodLabel(p) : '—'}
      sub={p ? (locked ? 'Заключен · без нови записи' : 'Отворен за осчетоводяване') : q.isError ? 'Периодът не е зареден' : undefined}
      icon={locked ? Lock : LockOpen}
      tone={locked ? 'warning' : 'neutral'}
      valueTone={locked ? 'warning' : 'foreground'}
      href="/settings"
      loading={q.isLoading}
    />
  );
}
