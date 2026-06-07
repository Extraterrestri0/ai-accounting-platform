import { cn } from '@/lib/utils';

/** Centered section heading with optional eyebrow + subtitle. Presentational only. */
export function SectionHeading({
  title, subtitle, eyebrow, className, align = 'center',
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  className?: string;
  align?: 'center' | 'left';
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' ? 'mx-auto text-center' : '', className)}>
      {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>}
      <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-pretty text-base text-muted-foreground sm:text-lg">{subtitle}</p>}
    </div>
  );
}
