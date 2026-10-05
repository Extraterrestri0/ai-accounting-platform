import { cn } from '@/lib/utils';
import { AccoMarkTile } from './acco-mark';

/** App icon — Acco mark (forest-green tile, white "a" with check). */
export function AppIcon({ className }: { className?: string }) {
  return <AccoMarkTile className={cn('h-9 w-9', className)} label="Счетоводство" />;
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
