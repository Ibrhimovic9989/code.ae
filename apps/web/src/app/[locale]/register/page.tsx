'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../lib/auth-context';
import { Button, Input, Label, Card, Spinner, ErrorText } from '../../../components/ui';

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = (params?.locale ?? 'ar') as 'ar' | 'en';
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({ email, password, displayName, locale });
      router.replace(`/${locale}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md items-center px-4 py-12">
      <Card className="w-full">
        <h1 className="mb-2 text-2xl font-bold">{t('auth.registerTitle')}</h1>
        <p className="mb-6 text-sm text-neutral-500">{t('auth.registerSubtitle')}</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="displayName">{t('auth.displayName')}</Label>
            <Input
              id="displayName"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
              dir="ltr"
            />
          </div>
          <div>
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
              dir="ltr"
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Spinner /> : t('auth.submitRegister')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          {t('auth.haveAccount')}{' '}
          <Link href={`/${locale}/login`} className="font-medium text-brand-600 hover:underline">
            {t('auth.switchToLogin')}
          </Link>
        </p>
      </Card>
    </main>
  );
}
