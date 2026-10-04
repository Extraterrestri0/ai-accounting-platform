'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import { useT } from '@/lib/i18n';
import { GoogleButton } from '@/components/app/google-button';
import { AuthShell, AuthDivider } from '@/components/app/auth-chrome';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FormValues = { email: string; password: string };

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const t = useT();
  const [submitting, setSubmitting] = React.useState(false);

  const schema = React.useMemo(() => z.object({
    email: z.string().email(t('auth.invalidEmail')),
    password: z.string().min(1, t('auth.enterPassword')),
  }), [t]);

  const { register, handleSubmit, formState: { errors } } =
    useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const err = new URLSearchParams(window.location.search).get('error');
    if (!err) return;
    if (err === 'google_not_configured') toast.message(t('auth.googleSoon'), { description: t('auth.googleSoonDesc') });
    else toast.error(t('auth.loginFail'), { description: err });
    window.history.replaceState({}, '', '/login');
  }, [t]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const result = await login(values.email, values.password);
      if (result.status === 'mfa_required') { toast.message(t('auth.mfaRequired')); return; }
      toast.success(t('auth.loginOk'));
      router.replace('/dashboard');
    } catch (e) {
      toast.error(t('auth.loginFail'), { description: e instanceof ApiError ? e.message : t('states.errorDesc') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      footer={<>{t('auth.noAccount')} <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">{t('auth.registerLink')}</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="ime@firma.bg" className="h-10" {...register('email')} aria-invalid={!!errors.email} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => toast.message(t('auth.forgot'), { description: t('auth.googleSoonDesc') })}>
              {t('auth.forgot')}
            </button>
          </div>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" className="h-10" {...register('password')} aria-invalid={!!errors.password} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </form>

      <AuthDivider label={t('auth.or')} />
      <GoogleButton />
    </AuthShell>
  );
}
