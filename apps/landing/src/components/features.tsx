import type { Locale, Messages } from '@/lib/i18n';

interface Props {
  locale: Locale;
  messages: Messages;
}

export function Features({ locale, messages: m }: Props) {
  const isAr = locale === 'ar';
  return (
    <section id="features" className="relative py-16 sm:py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-8">
        <div className="max-w-2xl">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand-400 sm:text-[11.5px]">
            /features
          </div>
          <h2
            className={`mt-3 text-balance text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-[34px] md:text-[44px] ${
              isAr ? 'font-arabic' : ''
            }`}
          >
            {m.features.title}
          </h2>
          <p className={`mt-3 max-w-xl text-[14.5px] text-neutral-400 sm:mt-4 sm:text-[15px] ${isAr ? 'font-arabic' : ''}`}>
            {m.features.subtitle}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-xl ring-1 ring-inset ring-white/5 sm:mt-12 sm:grid-cols-2 sm:rounded-2xl lg:grid-cols-3">
          {m.features.items.map((f, i) => (
            <FeatureCard key={i} index={i} locale={locale} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  title,
  body,
  badge,
  index,
  locale,
}: {
  title: string;
  body: string;
  badge: string;
  index: number;
  locale: Locale;
}) {
  const isAr = locale === 'ar';
  return (
    <article
      className="group relative bg-[rgb(var(--surface-2))] p-5 transition-colors hover:bg-[rgb(var(--surface-3))] sm:p-6 md:p-8"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Corner accent */}
      <div className="absolute end-4 top-4 font-mono text-[10px] uppercase tracking-[0.18em] text-brand-400/70 sm:end-5 sm:top-5 sm:text-[10.5px]">
        {String(index + 1).padStart(2, '0')}
      </div>

      <div className="flex items-center gap-2">
        <FeatureIcon kind={index} />
        <span className={`text-[10.5px] font-medium uppercase tracking-[0.16em] text-neutral-500 ${isAr ? 'font-arabic' : ''}`}>
          {badge}
        </span>
      </div>

      <h3
        className={`mt-4 text-[18px] font-semibold leading-snug tracking-[-0.01em] text-white sm:mt-5 sm:text-[20px] ${
          isAr ? 'font-arabic' : ''
        }`}
      >
        {title}
      </h3>
      <p className={`mt-2 text-[13.5px] leading-relaxed text-neutral-400 sm:mt-2.5 sm:text-[14px] ${isAr ? 'font-arabic' : ''}`}>
        {body}
      </p>
    </article>
  );
}

function FeatureIcon({ kind }: { kind: number }) {
  const icons: React.ReactNode[] = [
    // Agent
    <svg key="agent" viewBox="0 0 20 20" className="h-4 w-4 text-brand-400" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="7" r="3" />
      <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
      <path d="M3 7h2M15 7h2" strokeLinecap="round" />
    </svg>,
    // Sandbox
    <svg key="sandbox" viewBox="0 0 20 20" className="h-4 w-4 text-brand-400" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="5" width="14" height="11" rx="1.5" />
      <path d="M3 9h14M6 12h3M6 14h5" strokeLinecap="round" />
    </svg>,
    // Supabase
    <svg key="supabase" viewBox="0 0 20 20" className="h-4 w-4 text-brand-400" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10 3l7 10-7 4V3z" fill="currentColor" fillOpacity="0.12" />
      <path d="M10 3v14M10 3l7 10h-7" strokeLinejoin="round" />
    </svg>,
    // Deploy
    <svg key="deploy" viewBox="0 0 20 20" className="h-4 w-4 text-brand-400" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10 3l6 11H4l6-11z" strokeLinejoin="round" />
    </svg>,
    // Files
    <svg key="files" viewBox="0 0 20 20" className="h-4 w-4 text-brand-400" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 4h6l4 4v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" strokeLinejoin="round" />
      <path d="M11 4v4h4" strokeLinejoin="round" />
    </svg>,
    // Self-heal
    <svg key="heal" viewBox="0 0 20 20" className="h-4 w-4 text-brand-400" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="10" r="6.5" />
      <path d="M7 10l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>,
  ];
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03]">
      {icons[kind % icons.length]}
    </span>
  );
}
