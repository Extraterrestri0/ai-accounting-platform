'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> { value: T; label: React.ReactNode; count?: number }

/** Segmented control / filter chips: one selected value out of a short list. */
export function Segmented<T extends string>({ value, onChange, options, className, size = 'sm' }: {
  value: T; onChange: (v: T) => void; options: SegmentedOption<T>[]; className?: string; size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" className={cn('inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-md bg-surface-2 p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[6px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-8 px-3 text-sm',
              active ? 'bg-card text-foreground shadow-[0_1px_2px_hsl(160_20%_6%/.08)]' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cn('tabular-nums', active ? 'text-muted-foreground' : 'text-faint')}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
