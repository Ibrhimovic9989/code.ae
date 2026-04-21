import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function LandingPage() {
  const t = useTranslations();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 text-center">
      <p className="mb-4 text-sm font-medium text-brand-600">{t('brand.tagline')}</p>
      <h1 className="mb-6 text-4xl font-bold leading-tight md:text-6xl">{t('landing.heroTitle')}</h1>
      <p className="mb-10 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
        {t('landing.heroSubtitle')}
      </p>
      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="rounded-lg bg-brand-600 px-6 py-3 font-medium text-white transition hover:bg-brand-700"
        >
          {t('landing.ctaStart')}
        </Link>
        <Link
          href="#learn"
          className="rounded-lg border border-neutral-300 px-6 py-3 font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          {t('landing.ctaLearnMore')}
        </Link>
      </div>
    </main>
  );
}
