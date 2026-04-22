import Link from 'next/link';
import type { Locale, Messages } from '@/lib/i18n';
import { AppUrl } from '@/lib/app-url';

interface Props {
  locale: Locale;
  messages: Messages;
}

export function Hero({ locale, messages: m }: Props) {
  const isAr = locale === 'ar';
  return (
    <section className="relative isolate overflow-hidden">
      {/* Conic glow */}
      <div aria-hidden className="absolute inset-0 -z-10 mask-radial-fade">
        <div className="glow-conic absolute left-1/2 top-1/2 h-[85vmin] w-[85vmin] -translate-x-1/2 -translate-y-1/2 opacity-70" />
      </div>
      {/* Soft vignette at top to anchor the nav */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-black/40 to-transparent"
      />

      <div className="mx-auto flex max-w-6xl flex-col items-center px-5 pb-24 pt-20 text-center sm:px-8 sm:pt-28 md:pb-32 md:pt-32">
        {/* Kicker chip */}
        <div
          className="inline-flex animate-fade-in items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-medium text-neutral-300 backdrop-blur"
          style={{ animationDelay: '60ms' }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-400" />
          </span>
          {m.hero.kicker}
        </div>

        {/* Headline */}
        <h1
          className={`mt-7 max-w-4xl animate-fade-up text-balance font-display text-[44px] font-semibold leading-[1.05] tracking-[-0.03em] text-white sm:text-[64px] md:text-[76px] ${
            isAr ? 'font-arabic' : ''
          }`}
          style={{ animationDelay: '100ms' }}
        >
          <span className="text-gradient">{m.hero.title1}</span>
          <br />
          <span className="text-gradient-brand">{m.hero.title2}</span>
        </h1>

        {/* Subtitle */}
        <p
          className={`mt-6 max-w-2xl animate-fade-up text-balance text-[15.5px] leading-relaxed text-neutral-400 sm:text-[17px] ${
            isAr ? 'font-arabic' : ''
          }`}
          style={{ animationDelay: '200ms' }}
        >
          {m.hero.subtitle}
        </p>

        {/* CTAs */}
        <div
          className="mt-10 flex animate-fade-up flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: '320ms' }}
        >
          <Link href={`${AppUrl}/${locale}/register`} className="btn-primary inline-flex items-center gap-2">
            {m.hero.ctaPrimary}
            <ArrowIcon dir={isAr ? 'rtl' : 'ltr'} />
          </Link>
          <Link href={`/${locale}#how`} className="btn-ghost">
            {m.hero.ctaSecondary}
          </Link>
        </div>

        {/* Trust */}
        <p
          className="mt-5 animate-fade-up font-mono text-[11.5px] uppercase tracking-[0.15em] text-neutral-500"
          style={{ animationDelay: '420ms' }}
          dir="ltr"
        >
          {m.hero.trust}
        </p>

        {/* Window mock */}
        <div
          className="mt-16 w-full max-w-5xl animate-fade-up"
          style={{ animationDelay: '520ms' }}
        >
          <HeroWindow locale={locale} />
        </div>
      </div>
    </section>
  );
}

function ArrowIcon({ dir }: { dir: 'ltr' | 'rtl' }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={`h-3 w-3 transition-transform ${dir === 'rtl' ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 7h8M7 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeroWindow({ locale }: { locale: Locale }) {
  const isAr = locale === 'ar';
  const prompt = isAr
    ? 'ابنِ لي صفحة هبوط لعيادة أسنان مع نموذج حجز موعد'
    : 'build me a landing page for a dental clinic with a booking form';
  return (
    <div
      className="relative rounded-2xl border border-white/10 bg-[rgb(var(--surface-2))] p-2 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]"
      dir="ltr"
    >
      {/* Window chrome */}
      <div className="flex h-9 items-center gap-2 px-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        <div className="mx-auto flex h-6 items-center gap-2 rounded-md border border-white/5 bg-black/40 px-3 font-mono text-[11px] text-neutral-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
          code.ae / your-dental-clinic
        </div>
      </div>

      {/* Three-pane workspace mock */}
      <div className="grid grid-cols-[280px_1fr_1fr] gap-px rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/5 overflow-hidden">
        {/* Chat pane */}
        <div className="bg-[rgb(var(--surface-2))] p-4 text-start">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800 text-[10px] font-semibold text-neutral-300">
              Y
            </div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-neutral-500">you</div>
          </div>
          <p className={`text-[13.5px] leading-relaxed text-neutral-200 ${isAr ? 'font-arabic text-right' : ''}`} dir={isAr ? 'rtl' : 'ltr'}>
            {prompt}
            <span className="caret" />
          </p>
          <div className="mt-5 flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-400/15 text-[10px] font-semibold text-brand-400">
              A
            </div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-neutral-500">agent</div>
          </div>
          <p className={`mt-2 text-[13px] leading-relaxed text-neutral-400 ${isAr ? 'font-arabic text-right' : ''}`} dir={isAr ? 'rtl' : 'ltr'}>
            {isAr
              ? 'جاري إنشاء المشروع على Next.js 15 مع نموذج حجز مربوط بـ Supabase...'
              : "Setting up Next.js 15 with a booking form backed by Supabase…"}
          </p>
          <div className="mt-4 space-y-1.5">
            <ToolRow label="write_file" arg="app/page.tsx" />
            <ToolRow label="write_file" arg="app/api/book/route.ts" />
            <ToolRow label="exec" arg="bun install @supabase/supabase-js" />
          </div>
        </div>

        {/* Editor pane */}
        <div className="bg-[#0a0a0a] overflow-hidden">
          <div className="flex h-8 items-center gap-2 border-b border-white/5 px-3">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
            <span className="font-mono text-[11px] text-neutral-400">
              <span className="text-neutral-600">app / </span>
              <span className="text-neutral-200">page.tsx</span>
            </span>
            <span className="ms-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="font-mono text-[10px] text-neutral-500">saved</span>
          </div>
          <pre className="overflow-hidden px-4 py-3 font-mono text-[11.5px] leading-[1.55]">
<code>
<span className="text-pink-400">export default</span> <span className="text-sky-400">function</span> <span className="text-amber-300">Page</span>() {'{'}{'\n'}
{'  '}<span className="text-pink-400">return</span> ({'\n'}
{'    '}<span className="text-neutral-300">{'<'}</span><span className="text-rose-400">main</span> <span className="text-amber-300">className</span>=<span className="text-emerald-300">&ldquo;min-h-screen&rdquo;</span><span className="text-neutral-300">{'>'}</span>{'\n'}
{'      '}<span className="text-neutral-300">{'<'}</span><span className="text-rose-400">Hero</span> <span className="text-neutral-300">/{'>'}</span>{'\n'}
{'      '}<span className="text-neutral-300">{'<'}</span><span className="text-rose-400">Services</span> <span className="text-neutral-300">/{'>'}</span>{'\n'}
{'      '}<span className="text-neutral-300">{'<'}</span><span className="text-rose-400">BookingForm</span> <span className="text-neutral-300">/{'>'}</span>{'\n'}
{'      '}<span className="text-neutral-300">{'<'}</span><span className="text-rose-400">Footer</span> <span className="text-neutral-300">/{'>'}</span>{'\n'}
{'    '}<span className="text-neutral-300">{'<'}/</span><span className="text-rose-400">main</span><span className="text-neutral-300">{'>'}</span>{'\n'}
{'  '});{'\n'}
{'}'}
</code>
          </pre>
        </div>

        {/* Preview pane */}
        <div className="bg-neutral-50 text-neutral-900 overflow-hidden">
          <div className="flex h-8 items-center border-b border-neutral-200 px-3">
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
            </div>
            <div className="mx-auto flex h-5 items-center rounded border border-neutral-200 bg-white px-2 font-mono text-[10.5px] text-neutral-500">
              your-dental-clinic.vercel.app
            </div>
          </div>
          <div className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">
              Dental Care
            </div>
            <div className="mt-1 text-[18px] font-semibold leading-tight text-neutral-900">
              A brighter smile, in minutes.
            </div>
            <div className="mt-1 text-[11px] text-neutral-600">
              Licensed dentists in Dubai. Same-day appointments.
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="h-6 rounded bg-neutral-100" />
              <div className="h-6 rounded bg-neutral-100" />
              <div className="h-6 rounded bg-neutral-100" />
            </div>
            <div className="mt-3 h-7 w-full rounded-md bg-neutral-900 text-center text-[11px] font-medium leading-7 text-white">
              Book appointment
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolRow({ label, arg }: { label: string; arg: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/5 bg-black/30 px-2 py-1.5 font-mono text-[10.5px]">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      <span className="text-neutral-400">{label}</span>
      <span className="truncate text-neutral-500">{arg}</span>
    </div>
  );
}
