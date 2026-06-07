'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FileCode2, ArrowRight, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Endpoints } from '@/lib/api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { dateBG } from '@/lib/format';

const MONTHS_BG = ['', 'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];

/** Dashboard SAF-T readiness widget: latest export + errors/warnings/missing mappings. */
export function SaftReadinessWidget({ companyId }: { companyId?: string }) {
  const q = useQuery({ queryKey: ['saft', 'exports', companyId, 'latest'], queryFn: () => Endpoints.saftExports({ pageSize: 1 }), enabled: !!companyId });
  const latest = q.data?.[0];
  const c = latest?.validationSummary?.counts;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><FileCode2 className="h-4 w-4 text-primary" /> SAF-T готовност</CardTitle>
        <Button variant="outline" size="sm" asChild><Link href="/saft">Отвори <ArrowRight className="h-4 w-4" /></Link></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !latest ? (
          <p className="text-sm text-muted-foreground">Все още няма генериран SAF-T набор. Отворете SAF-T, за да генерирате.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{MONTHS_BG[latest.month]} {latest.year}</span>
              {latest.status === 'failed'
                ? <Badge variant="destructive">Неуспешен</Badge>
                : c && c.errors > 0 ? <Badge variant="destructive">С грешки</Badge>
                : <Badge variant="success">Готов</Badge>}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat icon={XCircle} label="Грешки" value={c?.errors ?? 0} tone={(c?.errors ?? 0) > 0 ? 'text-destructive' : 'text-foreground'} />
              <Stat icon={AlertTriangle} label="Предупр." value={c?.warnings ?? 0} tone={(c?.warnings ?? 0) > 0 ? 'text-warning' : 'text-foreground'} />
              <Stat icon={CheckCircle2} label="Бележки" value={c?.info ?? 0} tone="text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">Последно генериран: {dateBG(latest.generatedAt)}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof XCircle; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 p-2">
      <Icon className={`mx-auto mb-0.5 h-4 w-4 ${tone}`} />
      <p className={`text-sm font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
