import { cn } from '@/lib/utils';

/**
 * Acco mark: a green rounded square with a check — "human approval" is the
 * centre of the product. Single source for the app, auth pages and favicon.
 */
export function AppIcon({ className, tone = 'brand' }: { className?: string; tone?: 'brand' | 'ink' | 'light' }) {
  const bg = tone === 'brand' ? 'hsl(var(--brand))' : tone === 'ink' ? 'hsl(var(--foreground))' : '#FFFFFF';
  const fg = tone === 'light' ? '#1C6B4E' : tone === 'ink' ? 'hsl(var(--background))' : '#FFFFFF';
  return (
    <svg viewBox="0 0 32 32" className={cn('h-7 w-7', className)} role="img" aria-label="Acco">
      <rect width="32" height="32" rx="8" fill={bg} />
      <path d="M9.5 16.5l4.2 4.2L22.5 11.5" fill="none" stroke={fg} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Wordmark: icon + "acco". */
export function Brand({ className, tagline, tone = 'dark', size = 'md' }: {
  className?: string; tagline?: string | null; tone?: 'dark' | 'light'; size?: 'sm' | 'md' | 'lg';
}) {
  const text = tone === 'light' ? 'text-white' : 'text-foreground';
  const sub = tone === 'light' ? 'text-white/60' : 'text-muted-foreground';
  const iconSize = size === 'lg' ? 'h-9 w-9' : size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';
  const wordSize = size === 'lg' ? 'text-[22px]' : size === 'sm' ? 'text-[16px]' : 'text-[18px]';
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <AppIcon className={cn(iconSize, 'shrink-0')} tone={tone === 'light' ? 'light' : 'brand'} />
      <div className="min-w-0 leading-none">
        <div className={cn('font-semibold tracking-[-0.03em]', wordSize, text)}>acco</div>
        {tagline && <div className={cn('mt-1 text-2xs', sub)}>{tagline}</div>}
      </div>
    </div>
  );
}
