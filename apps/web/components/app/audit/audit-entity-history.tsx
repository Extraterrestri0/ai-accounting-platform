'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { AuditTimeline } from './audit-timeline';

/**
 * Complete chronological audit history for a single entity (document, invoice,
 * payment, review package, counterparty…). Drop-in for a detail tab/section/dialog.
 * Reads `GET /audit/entity/:type/:id` (AUDIT_READ, company-scoped, RLS-isolated).
 */
export function AuditEntityHistory({
  entityType, entityId, enabled = true,
}: {
  entityType: string;
  entityId?: string;
  enabled?: boolean;
}) {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const q = useQuery({
    queryKey: ['audit', 'entity', entityType, entityId, companyId],
    queryFn: () => Endpoints.auditEntity(entityType, entityId!),
    enabled: enabled && !!entityId && !!companyId,
  });

  return (
    <AuditTimeline
      events={q.data}
      isLoading={q.isLoading}
      isError={q.isError}
      onRetry={() => q.refetch()}
      emptyTitle="Няма история"
      emptyDesc="За този запис още няма регистрирани събития в одита."
    />
  );
}
