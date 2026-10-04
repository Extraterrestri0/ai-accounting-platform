'use client';

import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n';

type Variant = 'default' | 'success' | 'warning' | 'destructive' | 'neutral' | 'outline' | 'info';

const VARIANT: Record<string, Variant> = {
  uploaded: 'neutral', pending_upload: 'neutral', pending_scan: 'info', scanning: 'info',
  ready: 'success', ready_for_review: 'warning', clean: 'success', infected: 'destructive', quarantined: 'destructive',
  extracting: 'info', extracted: 'warning', reviewing: 'warning', reviewed: 'success',
  posted: 'success', approved: 'success', rejected: 'destructive', draft: 'neutral', issued: 'success',
  failed: 'destructive', trashed: 'neutral', deleted: 'neutral',
};

export function StatusBadge({ status }: { status?: string }) {
  const t = useT();
  if (!status) return <Badge variant="neutral">—</Badge>;
  const variant = VARIANT[status] ?? 'neutral';
  const label = t(`docStatus.${status}`);
  return <Badge variant={variant} dot>{label === `docStatus.${status}` ? status : label}</Badge>;
}
