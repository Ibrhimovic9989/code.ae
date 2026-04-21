'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Locale } from '@code-ae/shared';
import { useAuth } from '../lib/auth-context';
import { Button } from './ui';
import { LocaleSwitcher } from './locale-switcher';

export function Header({ locale }: { locale: Locale }) {
  const t = useTranslations();
  const { status, user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <Link href={`/${locale}`} className="flex items-center gap-2 text-lg font-bold">
          <span className="rounded bg-brand-600 px-2 py-1 text-white">code.ae</span>
        </Link>

        <nav className="flex items-center gap-2">
          {status === 'authenticated' ? (
            <>
              <Link
                href={`/${locale}/dashboard`}
                className="rounded px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {t('nav.dashboard')}
              </Link>
              <span className="text-sm text-neutral-500">{user?.displayName}</span>
              <LocaleSwitcher current={locale} />
              <Button variant="ghost" onClick={() => void logout()}>
                {t('nav.logout', { default: 'Logout' })}
              </Button>
            </>
          ) : (
            <>
              <LocaleSwitcher current={locale} />
              <Link
                href={`/${locale}/login`}
                className="rounded px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {t('nav.signIn')}
              </Link>
              <Link
                href={`/${locale}/register`}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                {t('nav.signUp')}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
