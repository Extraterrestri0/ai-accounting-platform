'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { toast } from 'sonner';

/** Receives the access token from the Google callback redirect (URL fragment) and signs in. */
export default function OAuthCallbackPage() {
  const router = useRouter();
  const { completeOAuth } = useAuth();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
    const params = new URLSearchParams(hash);
    const token = params.get('access');
    if (!token) { setError('Липсва токен от Google.'); return; }
    (async () => {
      try {
        await completeOAuth(token);
        toast.success('Влязохте с Google');
        router.replace('/dashboard');
      } catch {
        setError('Неуспешно влизане с Google.');
      }
    })();
  }, [completeOAuth, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      {error ? (
        <>
          <p className="text-sm text-destructive">{error}</p>
          <button className="text-sm text-primary hover:underline" onClick={() => router.replace('/login')}>Обратно към вход</button>
        </>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Влизане с Google…</p>
        </>
      )}
    </div>
  );
}
