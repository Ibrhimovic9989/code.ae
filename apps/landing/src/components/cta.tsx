import Link from 'next/link';
import type { Locale, Messages } from '@/lib/i18n';
import { AppUrl } from '@/lib/app-url';

export function CTA({ locale, messages: m }: { locale: Locale; messages: Messages }) {
  const isAr = locale === 'ar';
  return (
    <section id="pricing" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[rgb(var(--surface-2))] p-10 text-center md:p-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70 mask-radial-fade"
          >
            <div className="glow-conic absolute left-1/2 top-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-dots opacity-30 mask-radial-fade"
          />

          <div className="relative">
            <h2
              className={`text-balance text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-white md:text-[44px] ${
                isAr ? 'font-arabic' : ''
              }`}
            >
              {m.cta.title}
            </h2>
            <p
              className={`mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-400 ${
                isAr ? 'font-arabic' : ''
              }`}
            >
              {m.cta.subtitle}
            </p>
            <Link
              href={`${AppUrl}/${locale}/register`}
              className="btn-primary mt-8 inline-flex items-center gap-2"
            >
              {m.cta.button}
              <svg viewBox="0 0 14 14" className={`h-3 w-3 ${isAr ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 7h8M7 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
