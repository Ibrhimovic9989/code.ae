'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Locale } from '@code-ae/shared';
import { useAuth } from '../lib/auth-context';
import { Button } from './ui';
import { LocaleSwitcher } from './locale-switcher';
import { ThemeToggle } from './theme-toggle';

export function Header({ locale }: { locale: Locale }) {
  const t = useTranslations();
  const { status, user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/75 backdrop-blur-md dark:border-neutral-900 dark:bg-neutral-950/75">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-4 px-4">
        <Link
          href={`/${locale}`}
          className="group flex items-center gap-1.5 text-[14px] font-semibold tracking-tight"
        >
          <span className="h-4 w-4 rounded-sm bg-neutral-900 dark:bg-white" />
          <span className="text-neutral-900 dark:text-neutral-100">code</span>
          <span className="text-neutral-400 dark:text-neutral-600">.ae</span>
        </Link>

        <nav className="flex items-center gap-1">
          {status === 'authenticated' ? (
            <>
              <Link
                href={`/${locale}/dashboard`}
                className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
              >
                {t('nav.dashboard')}
              </Link>
              <span className="mx-1 text-[13px] text-neutral-400 dark:text-neutral-600">
                {user?.displayName}
              </span>
              <div className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
              <LocaleSwitcher current={locale} />
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={() => void logout()}>
                {t('nav.logout')}
              </Button>
            </>
          ) : (
            <>
              <LocaleSwitcher current={locale} />
              <ThemeToggle />
              <div className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
              <Link
                href={`/${locale}/login`}
                className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
              >
                {t('nav.signIn')}
              </Link>
              <Link
                href={`/${locale}/register`}
                className="rounded-md bg-neutral-900 px-2.5 py-1.5 text-[13px] font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
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
