'use client';

import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SaftExportStatus } from '@/lib/api/types';

type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'neutral' | 'outline';

const STATUS: Record<SaftExportStatus, { label: string; variant: BadgeVariant; spin?: boolean }> = {
  queued: { label: 'На опашка', variant: 'neutral' },
  processing: { label: 'Обработва се', variant: 'neutral', spin: true },
  completed: { label: 'Завършен', variant: 'success' },
  generated: { label: 'Генериран', variant: 'success' },
  failed: { label: 'Неуспешен', variant: 'destructive' },
};

/** Lifecycle badge covering all v1 + v2 statuses. */
export function SaftStatusBadge({ status }: { status: SaftExportStatus }) {
  const s = STATUS[status] ?? STATUS.queued;
  return (
    <Badge variant={s.variant} className="gap-1">
      {s.spin && <Loader2 className="h-3 w-3 animate-spin" />}
      {s.label}
    </Badge>
  );
}

/** XSD validation state: valid / invalid / not-validated (null|undefined = no schema bound). */
export function SaftXsdBadge({ xsdValid }: { xsdValid?: boolean | null }) {
  if (xsdValid === true) return <Badge variant="success">XSD: валиден</Badge>;
  if (xsdValid === false) return <Badge variant="destructive">XSD: невалиден</Badge>;
  return <Badge variant="neutral">XSD: невалидиран</Badge>;
}

export const isInFlight = (s: SaftExportStatus): boolean => s === 'queued' || s === 'processing';
export const hasXmlArtifact = (s: SaftExportStatus): boolean => s === 'completed';
