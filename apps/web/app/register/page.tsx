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

type FormValues = { companyName: string; email: string; password: string };

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
    <AuthShell
      title={t('auth.registerTitle')}
      subtitle={t('auth.registerSubtitle')}
      footer={<>{t('auth.hasAccount')} <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">{t('auth.loginLink')}</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="companyName">{t('auth.companyName')}</Label>
          <Input id="companyName" placeholder="Моята Фирма ЕООД" className="h-10" {...register('companyName')} aria-invalid={!!errors.companyName} />
          {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="ime@firma.bg" className="h-10" {...register('email')} aria-invalid={!!errors.email} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t('auth.password')}</Label>
          <Input id="password" type="password" autoComplete="new-password" placeholder={t('auth.minPassword')} className="h-10" {...register('password')} aria-invalid={!!errors.password} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? t('auth.creating') : t('auth.createAccount')}
        </Button>
      </form>

      <AuthDivider label={t('auth.or')} />
      <GoogleButton label={t('auth.googleRegister')} />
    </AuthShell>
  );
}
