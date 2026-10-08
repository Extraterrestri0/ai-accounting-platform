'use client';

import { useQuery } from '@tanstack/react-query';
import { Lock, LockOpen } from 'lucide-react';
import { Endpoints } from '@/lib/api/endpoints';
import { StatCard } from '@/components/app/stat-card';
import { periodLabel } from '@/components/app/accounting-periods-tab';

/** Dashboard KPI: the current accounting period and its lock status (Task 4.3). */
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
      value={q.isLoading || !p ? '…' : periodLabel(p)}
      sub={p ? (locked ? 'Заключен' : 'Отворен') : undefined}
      icon={locked ? Lock : LockOpen}
      tone={locked ? 'warning' : 'success'}
      valueTone={locked ? 'warning' : 'foreground'}
    />
  );
}
