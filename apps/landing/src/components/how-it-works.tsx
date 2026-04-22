import type { Locale, Messages } from '@/lib/i18n';

interface Props {
  locale: Locale;
  messages: Messages;
}

export function HowItWorks({ locale, messages: m }: Props) {
  const isAr = locale === 'ar';
  return (
    <section id="how" className="relative py-24 md:py-32">
      {/* decorative top hairline */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <div className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-brand-400">
            /how-it-works
          </div>
          <h2
            className={`mt-3 text-balance text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-white md:text-[44px] ${
              isAr ? 'font-arabic' : ''
            }`}
          >
            {m.how.title}
          </h2>
          <p className={`mt-4 max-w-xl text-[15px] text-neutral-400 ${isAr ? 'font-arabic' : ''}`}>
            {m.how.subtitle}
          </p>
        </div>

        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {m.how.steps.map((s, i) => (
            <li key={i} className="card-surface p-6 md:p-8">
              <div className="flex items-center gap-3">
                <span
                  className="font-mono text-[13px] font-medium text-brand-400"
                  dir={isAr ? 'rtl' : 'ltr'}
                >
                  {s.num}
                </span>
                <span className="h-px flex-1 bg-white/10" />
              </div>
              <h3
                className={`mt-6 text-[20px] font-semibold leading-snug text-white ${
                  isAr ? 'font-arabic' : ''
                }`}
              >
                {s.title}
              </h3>
              <p className={`mt-2 text-[14px] leading-relaxed text-neutral-400 ${isAr ? 'font-arabic' : ''}`}>
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
