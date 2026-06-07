'use client';

import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n';

type Variant = 'default' | 'success' | 'warning' | 'destructive' | 'neutral' | 'outline';

const VARIANT: Record<string, Variant> = {
  uploaded: 'neutral', pending_upload: 'neutral', pending_scan: 'warning', scanning: 'warning',
  ready: 'success', ready_for_review: 'success', clean: 'success', infected: 'destructive',
  extracting: 'warning', extracted: 'success', reviewing: 'warning', reviewed: 'success',
  posted: 'success', approved: 'success', rejected: 'destructive', draft: 'neutral', issued: 'success',
};

export function StatusBadge({ status }: { status?: string }) {
  const t = useT();
  if (!status) return <Badge variant="neutral">—</Badge>;
  const variant = VARIANT[status] ?? 'neutral';
  const label = t(`docStatus.${status}`);
  return <Badge variant={variant}>{label === `docStatus.${status}` ? status : label}</Badge>;
}
