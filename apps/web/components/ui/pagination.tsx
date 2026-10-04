'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

export function Pagination({ page, totalPages, total, unit, onChange }: {
  page: number; totalPages: number; total?: number; unit?: string; onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-[13px]">
      <span className="text-muted-foreground">
        {total !== undefined && <><span className="tabular-nums text-foreground">{total}</span> {unit ?? ''} · </>}
        стр. <span className="tabular-nums">{page}</span> / <span className="tabular-nums">{totalPages}</span>
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" aria-label="Предишна" disabled={page <= 1} onClick={() => onChange(Math.max(1, page - 1))}><ChevronLeft /></Button>
        <Button variant="outline" size="icon-sm" aria-label="Следваща" disabled={page >= totalPages} onClick={() => onChange(Math.min(totalPages, page + 1))}><ChevronRight /></Button>
      </div>
    </div>
  );
}
