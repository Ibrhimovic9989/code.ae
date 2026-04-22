import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function LandingPage() {
  const t = useTranslations();

  return (
    <main className="relative isolate mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col items-center justify-center overflow-hidden px-4 py-20 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 mask-radial-fade">
        <div className="glow-conic absolute left-1/2 top-1/2 h-[90vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 opacity-60" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50 mask-fade-bottom"
      />

      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11.5px] font-medium text-neutral-300 backdrop-blur">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-400" />
        </span>
        {t('brand.tagline')}
      </div>

      <h1 className="mt-6 max-w-3xl text-balance text-[40px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[56px] md:text-[68px]">
        <span className="text-gradient">{t('landing.heroTitle')}</span>
      </h1>

      <p className="mt-5 max-w-xl text-balance text-[15px] leading-relaxed text-neutral-400 sm:text-[17px]">
        {t('landing.heroSubtitle')}
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Link href="/dashboard" className="btn-primary">
          {t('landing.ctaStart')}
          <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 7h8M7 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <Link href="#learn" className="btn-ghost">
          {t('landing.ctaLearnMore')}
        </Link>
      </div>
    </main>
  );
}
