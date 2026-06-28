'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import { useT } from '@/lib/i18n';
import { GoogleButton } from '@/components/app/google-button';
import { AccoBrand, LangToggle } from '@/components/app/auth-chrome';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FormValues = { email: string; password: string };

/** Acco palette scoped to the auth pages — overrides the app tokens here only
    (cream + deep forest + brass), leaving the authenticated app theme untouched. */
const ACCO: Record<string, string> = {
  '--background': '41 42% 93%', '--foreground': '161 20% 16%',
  '--card': '0 0% 100%', '--card-foreground': '161 20% 16%',
  '--primary': '168 53% 15%', '--primary-foreground': '41 42% 95%', '--primary-soft': '40 43% 96%',
  '--secondary': '40 40% 95%', '--secondary-foreground': '168 53% 15%',
  '--muted': '40 40% 95%', '--muted-foreground': '150 6% 42%',
  '--accent': '40 40% 95%', '--accent-foreground': '168 53% 15%',
  '--border': '40 33% 84%', '--input': '40 33% 84%', '--ring': '36 37% 48%',
  '--sidebar': '168 53% 14%', '--sidebar-foreground': '150 18% 75%',
};
const SERIF = { fontFamily: "'Newsreader', Georgia, serif" } as React.CSSProperties;

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
    useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: 'demo@demo.bg', password: '' } });

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
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-2" style={{ ...ACCO, colorScheme: 'light' } as React.CSSProperties}>
      <div className="relative hidden overflow-hidden bg-sidebar lg:block">
        <div className="absolute inset-0 bg-mesh-brand" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <AccoBrand tone="light" tagline={t('auth.tagline')} />
          <div className="max-w-md space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" style={{ color: '#E9C98C' }} /> AI счетоводство · MVP
            </span>
            <h1 className="text-[2.6rem] font-medium leading-[1.06] tracking-tight" style={SERIF}>{t('auth.loginTitle')}</h1>
            <ul className="space-y-3 text-sm">
              {[ShieldCheck, Sparkles, LockKeyhole].map((Icon, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-sm transition-colors hover:bg-white/[0.1]">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-white/25 to-white/5 ring-1 ring-white/15"><Icon className="h-4 w-4 text-white" /></span>
                  <span className="text-white/85">{[
                    'Изолация на данни на ниво наемател (Postgres RLS)',
                    'AI предлага, човекът решава — никога обратното',
                    'Неизменяема главна книга и одитна следа',
                  ][i]}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-white/55">EUR · EU · Хостинг в ЕС</p>
        </div>
      </div>

      <div className="relative flex items-center justify-center p-6 sm:p-12">
        <LangToggle className="absolute right-4 top-4" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-aurora opacity-70" />
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><AccoBrand tagline={t('auth.tagline')} /></div>

          <div className="mb-8">
            <h2 className="text-[30px] font-medium leading-tight tracking-tight" style={SERIF}>{t('auth.loginTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('auth.loginSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="you@company.bg" {...register('email')} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => toast.message(t('auth.forgot'), { description: t('auth.googleSoonDesc') })}>
                  {t('auth.forgot')}
                </button>
              </div>
              <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...register('password')} aria-invalid={!!errors.password} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full bg-none bg-[#123A33] text-[#F4EFE4] shadow-none hover:bg-[#0F312C] hover:brightness-100" size="lg" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">{t('auth.or')}</span><span className="h-px flex-1 bg-border" />
          </div>

          <GoogleButton />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">{t('auth.registerLink')}</Link>
          </p>

          <div className="ring-grad mt-6 overflow-hidden rounded-xl bg-primary-soft/60 p-3.5 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> {t('auth.demoAccess')}
            </p>
            <p className="mt-1 font-mono text-[11px]">{t('auth.demoHint')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
