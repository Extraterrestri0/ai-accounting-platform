'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AUDIT_CATEGORIES, AUDIT_ENTITY_TYPES, ACTOR_TYPE_LABEL } from './audit-labels';

export interface AuditFilterState {
  search?: string;
  actorType?: string;
  action?: string;       // category prefix
  entityType?: string;
  from?: string;
  to?: string;
}

const selectCls =
  'h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Filter bar for the audit trail: search, actor, action category, entity, date range. */
export function AuditFilters({ value, onChange }: { value: AuditFilterState; onChange: (next: AuditFilterState) => void }) {
  const set = (patch: Partial<AuditFilterState>) => onChange({ ...value, ...patch });
  const active = !!(value.search || value.actorType || value.action || value.entityType || value.from || value.to);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[12rem] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Търсене по действие, обект, причина…" value={value.search ?? ''} onChange={(e) => set({ search: e.target.value })} />
      </div>

      <select className={selectCls} value={value.actorType ?? ''} onChange={(e) => set({ actorType: e.target.value || undefined })}>
        <option value="">Всички автори</option>
        {Object.entries(ACTOR_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>

      <select className={selectCls} value={value.action ?? ''} onChange={(e) => set({ action: e.target.value || undefined })}>
        <option value="">Всички действия</option>
        {AUDIT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>

      <select className={selectCls} value={value.entityType ?? ''} onChange={(e) => set({ entityType: e.target.value || undefined })}>
        <option value="">Всички обекти</option>
        {AUDIT_ENTITY_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>

      <Input type="date" className="w-auto" value={value.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} title="От дата" />
      <span className="text-muted-foreground">–</span>
      <Input type="date" className="w-auto" value={value.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} title="До дата" />

      {active && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}><X className="h-4 w-4" /> Изчисти</Button>
      )}
    </div>
  );
}
