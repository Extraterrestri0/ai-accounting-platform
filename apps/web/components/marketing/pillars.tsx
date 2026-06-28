'use client';

import { useT } from '@/lib/i18n';
import { PILLARS } from '@/lib/marketing/content';

export function Pillars() {
  const t = useT();
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {PILLARS.map(({ id, icon: Icon }) => (
        <div key={id} className="flex flex-col gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-success-soft text-success">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">{t(`marketing.pillars.${id}.title`)}</h3>
          <p className="text-sm text-muted-foreground">{t(`marketing.pillars.${id}.desc`)}</p>
        </div>
      ))}
    </div>
  );
}
