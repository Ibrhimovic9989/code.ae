'use client';

import { usePathname } from 'next/navigation';
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '@code-ae/shared';

export function LocaleSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();

  const swapLocale = (target: Locale) => {
    if (!pathname) return '/';
    const parts = pathname.split('/');
    if ((SUPPORTED_LOCALES as readonly string[]).includes(parts[1] ?? '')) {
      parts[1] = target;
      return parts.join('/');
    }
    return `/${target}${pathname}`;
  };

  return (
    <div className="flex gap-1 rounded-md border border-neutral-200 p-0.5 text-xs dark:border-neutral-800">
      {SUPPORTED_LOCALES.map((l) => (
        <a
          key={l}
          href={swapLocale(l)}
          className={
            current === l
              ? 'rounded bg-neutral-900 px-2 py-1 text-white dark:bg-white dark:text-neutral-900'
              : 'rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
          }
        >
          {LOCALE_NAMES[l]}
        </a>
      ))}
    </div>
  );
}
