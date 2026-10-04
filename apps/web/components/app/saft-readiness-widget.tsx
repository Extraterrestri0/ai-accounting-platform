'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FileCode2, ArrowRight } from 'lucide-react';
import { Endpoints } from '@/lib/api/endpoints';
import { SaftStatusBadge, SaftXsdBadge, isInFlight, hasXmlArtifact } from '@/components/app/saft-status';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { dateBG } from '@/lib/format';
import { cn } from '@/lib/utils';

const MONTHS_BG = ['', 'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];

/** Dashboard SAF-T readiness widget: latest export period as the key figure, status + XSD + issue counts. */
export function SaftReadinessWidget({ companyId }: { companyId?: string }) {
  const q = useQuery({
    queryKey: ['saft', 'exports', companyId, 'latest'],
    queryFn: () => Endpoints.saftExports({ pageSize: 1 }),
    enabled: !!companyId,
    refetchInterval: (query) => ((query.state.data ?? []).some((e) => isInFlight(e.status)) ? 3000 : false),
  });
  const latest = q.data?.[0];
  const c = latest?.validationSummary?.counts;

  return (
    <Card>
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="t-overline">SAF-T готовност</p>
          <FileCode2 className="h-4 w-4 text-faint" strokeWidth={1.75} />
        </div>
        {q.isLoading ? (
          <Skeleton className="mt-3 h-7 w-32" />
        ) : !latest ? (
          <>
            <p className="mt-3 text-[26px] font-semibold leading-none tracking-[-0.02em] text-faint">—</p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">Все още няма генериран SAF-T експорт.</p>
          </>
        ) : (
          <>
            <p className="mt-3 text-[26px] font-semibold leading-none tracking-[-0.02em] text-foreground">{MONTHS_BG[latest.month]} {latest.year}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <SaftStatusBadge status={latest.status} />
              {hasXmlArtifact(latest.status) && <SaftXsdBadge xsdValid={latest.xsdValid} />}
            </div>
            <div className="mt-3 space-y-1 border-t border-border pt-3">
              <p className="t-caption">
                <span className={cn('tabular-nums', (c?.errors ?? 0) > 0 ? 'font-medium text-destructive' : 'text-foreground')}>{c?.errors ?? 0}</span> грешки ·{' '}
                <span className={cn('tabular-nums', (c?.warnings ?? 0) > 0 ? 'font-medium text-warning' : 'text-foreground')}>{c?.warnings ?? 0}</span> предупреждения ·{' '}
                <span className="tabular-nums text-foreground">{c?.info ?? 0}</span> бележки
              </p>
              <p className="t-caption">Последно обновен: {dateBG(latest.generatedAt)}</p>
            </div>
          </>
        )}
        <Link href="/saft" className="mt-auto inline-flex items-center gap-1 pt-3 text-[13px] font-medium text-brand hover:underline">
          Отвори SAF-T <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
