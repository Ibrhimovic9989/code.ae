'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../lib/auth-context';
import { Input, Label, Spinner, ErrorText } from '../../../components/ui';

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace(`/${params?.locale ?? 'ar'}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative isolate flex min-h-[calc(100vh-3rem)] items-center justify-center overflow-hidden px-4 py-16">
      {/* Decorative glow + dot grid, same language as the landing hero */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 mask-radial-fade">
        <div className="glow-conic absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 opacity-60" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50 mask-fade-bottom"
      />

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-neutral-300 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            {t('brand.tagline')}
          </div>
          <h1 className="mt-5 text-[28px] font-semibold leading-tight tracking-tight text-white">
            {t('auth.loginTitle')}
          </h1>
          <p className="mt-2 text-[14px] text-neutral-400">{t('auth.loginSubtitle')}</p>
        </div>

        <div className="card-surface p-7">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5"
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5"
                dir="ltr"
              />
            </div>
            <ErrorText>{error}</ErrorText>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Spinner /> : t('auth.submitLogin')}
            </button>
          </form>

          <p className="mt-6 text-center text-[13px] text-neutral-500">
            {t('auth.noAccount')}{' '}
            <Link href={`/${params?.locale ?? 'ar'}/register`} className="font-medium text-brand-400 hover:text-brand-300">
              {t('auth.switchToRegister')}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
