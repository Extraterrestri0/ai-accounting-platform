'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api, API_BASE } from '@/lib/api/client';
import { useT } from '@/lib/i18n';

/** Google "G" logo (official 4-color mark). */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

export function GoogleButton({ label }: { label?: string }) {
  const t = useT();
  const [enabled, setEnabled] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let active = true;
    api<{ googleEnabled: boolean }>('/auth/config', { anonymous: true, company: false })
      .then((c) => { if (active) setEnabled(c.googleEnabled); })
      .catch(() => { if (active) setEnabled(false); });
    return () => { active = false; };
  }, []);

  const onClick = () => {
    if (enabled) {
      window.location.href = `${API_BASE}/auth/google`;
    } else {
      toast.message(t('auth.googleSoon'), { description: t('auth.googleSoonDesc') });
    }
  };

  return (
    <Button type="button" variant="outline" size="lg" className="w-full" onClick={onClick} aria-disabled={enabled === false}>
      <GoogleIcon />
      {label ?? t('auth.google')}
      {enabled === false && <span className="ml-1 text-xs text-muted-foreground">{t('auth.googleNotConfigured')}</span>}
    </Button>
  );
}
