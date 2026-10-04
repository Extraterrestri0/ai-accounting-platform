'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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

/** Filter bar for the audit trail: search, actor, action category, entity, date range. */
export function AuditFilters({ value, onChange }: { value: AuditFilterState; onChange: (next: AuditFilterState) => void }) {
  const set = (patch: Partial<AuditFilterState>) => onChange({ ...value, ...patch });
  const active = !!(value.search || value.actorType || value.action || value.entityType || value.from || value.to);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <Input className="pl-9" placeholder="Търсене по действие, обект, причина…" aria-label="Търсене в одита"
          value={value.search ?? ''} onChange={(e) => set({ search: e.target.value })} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select className="w-auto min-w-[9.5rem]" aria-label="Автор" value={value.actorType ?? ''} onChange={(e) => set({ actorType: e.target.value || undefined })}>
          <option value="">Всички автори</option>
          {Object.entries(ACTOR_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>

        <Select className="w-auto min-w-[10rem]" aria-label="Действие" value={value.action ?? ''} onChange={(e) => set({ action: e.target.value || undefined })}>
          <option value="">Всички действия</option>
          {AUDIT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>

        <Select className="w-auto min-w-[9.5rem]" aria-label="Обект" value={value.entityType ?? ''} onChange={(e) => set({ entityType: e.target.value || undefined })}>
          <option value="">Всички обекти</option>
          {AUDIT_ENTITY_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>

        <div className="flex items-center gap-1.5">
          <Input type="date" className="w-auto tabular-nums" aria-label="От дата" value={value.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} title="От дата" />
          <span className="text-faint">–</span>
          <Input type="date" className="w-auto tabular-nums" aria-label="До дата" value={value.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} title="До дата" />
        </div>

        {active && (
          <Button variant="ghost" size="sm" onClick={() => onChange({})}><X /> Изчисти</Button>
        )}
      </div>
    </div>
  );
}
