'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import { useT } from '@/lib/i18n';
import { GoogleButton } from '@/components/app/google-button';
import { AccoBrand, LangToggle } from '@/components/app/auth-chrome';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FormValues = { companyName: string; email: string; password: string };

/** Acco palette scoped to the auth pages only (cream + forest + brass). */
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

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerAccount } = useAuth();
  const t = useT();
  const [submitting, setSubmitting] = React.useState(false);

  const schema = React.useMemo(() => z.object({
    companyName: z.string().min(2, t('auth.companyName')),
    email: z.string().email(t('auth.invalidEmail')),
    password: z.string().min(8, t('auth.minPassword')),
  }), [t]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await registerAccount(values.email, values.password, values.companyName);
      toast.success(t('auth.registerOk'));
      router.replace('/dashboard');
    } catch (e) {
      const msg = e instanceof ApiError ? (e.status === 409 ? t('auth.emailTaken') : e.message) : t('states.errorDesc');
      toast.error(t('auth.registerFail'), { description: msg });
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
            <h1 className="text-[2.6rem] font-medium leading-[1.06] tracking-tight" style={SERIF}>{t('auth.registerTitle')}</h1>
            <ul className="space-y-3 text-sm">
              {['Безплатна демо фирма веднага', 'AI извличане от фактури', 'ДДС регистри и отчети', 'Неизменяема главна книга'].map((x) => (
                <li key={x} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-sm transition-colors hover:bg-white/[0.1]">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-success/25 ring-1 ring-success/30"><Check className="h-4 w-4 text-white" /></span>
                  <span className="text-white/85">{x}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-white/55">EUR · EU · zero-retention AI</p>
        </div>
      </div>

      <div className="relative flex items-center justify-center p-6 sm:p-12">
        <LangToggle className="absolute right-4 top-4 z-10" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-aurora opacity-70" />
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><AccoBrand tagline={t('auth.tagline')} /></div>
          <div className="mb-8">
            <h2 className="text-[30px] font-medium leading-tight tracking-tight" style={SERIF}>{t('auth.registerTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('auth.registerSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="companyName">{t('auth.companyName')}</Label>
              <Input id="companyName" placeholder="Моята Фирма ЕООД" {...register('companyName')} aria-invalid={!!errors.companyName} />
              {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="you@company.bg" {...register('email')} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input id="password" type="password" autoComplete="new-password" placeholder={t('auth.minPassword')} {...register('password')} aria-invalid={!!errors.password} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full bg-none bg-[#123A33] text-[#F4EFE4] shadow-none hover:bg-[#0F312C] hover:brightness-100" size="lg" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? t('auth.creating') : t('auth.createAccount')}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">{t('auth.or')}</span><span className="h-px flex-1 bg-border" />
          </div>
          <GoogleButton label={t('auth.googleRegister')} />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">{t('auth.loginLink')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
