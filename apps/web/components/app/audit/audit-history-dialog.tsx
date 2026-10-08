'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AuditEntityHistory } from './audit-entity-history';

/**
 * Reusable "audit history" dialog for any entity detail surface (documents,
 * invoices, payments, counterparties…). Open while `entityId` is non-null.
 */
export function AuditHistoryDialog({
  entityType, entityId, title = 'Одитна история', subtitle, onOpenChange,
}: {
  entityType: string;
  entityId: string | null;
  title?: string;
  subtitle?: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!entityId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle ?? 'Пълна хронология на промените по този запис.'}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <AuditEntityHistory entityType={entityType} entityId={entityId ?? undefined} enabled={!!entityId} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Затвори</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
