import { cn } from '@/lib/utils';

/** App icon — blue rounded square with bar-chart + check (design-system mark). */
export function AppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={cn('h-9 w-9', className)} role="img" aria-label="Счетоводство">
      <rect width="96" height="96" rx="22" fill="#2F7BE0" />
      <rect x="26" y="54" width="11" height="18" rx="3" fill="#FFFFFF" />
      <rect x="42.5" y="42" width="11" height="30" rx="3" fill="#FFFFFF" />
      <rect x="59" y="26" width="11" height="46" rx="3" fill="#FFFFFF" opacity="0.92" />
      <path d="M30 35.5 L37 42 L52 24" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
    </svg>
  );
}

/** Full brand lockup: icon + wordmark + tagline. */
export function Brand({ className, tagline = 'AI Accounting · MVP', tone = 'dark' }: { className?: string; tagline?: string | null; tone?: 'dark' | 'light' }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <AppIcon className="h-8 w-8 shrink-0" />
      <div className="min-w-0 leading-tight">
        <div className={cn('text-[15px] font-semibold tracking-tight', tone === 'light' ? 'text-white' : 'text-foreground')}>Счетоводство</div>
        {tagline && <div className={cn('text-[11px]', tone === 'light' ? 'text-white/55' : 'text-muted-foreground')}>{tagline}</div>}
      </div>
    </div>
  );
}
