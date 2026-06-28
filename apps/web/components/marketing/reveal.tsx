'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Lightweight scroll-in reveal (IntersectionObserver, zero-dep). Honors
 * prefers-reduced-motion via the .reveal CSS in globals.css.
 */
export function Reveal({
  children, className, delay = 0,
}: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn('reveal', shown && 'is-visible', className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
