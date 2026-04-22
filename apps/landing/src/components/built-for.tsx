import type { Locale, Messages } from '@/lib/i18n';

interface Props {
  locale: Locale;
  messages: Messages;
}

export function BuiltFor({ locale, messages: m }: Props) {
  const isAr = locale === 'ar';
  return (
    <section className="relative py-16 sm:py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 sm:gap-12 sm:px-6 md:grid-cols-[1.1fr_1fr] md:items-center md:px-8">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand-400 sm:text-[11.5px]">
            /gulf-native
          </div>
          <h2
            className={`mt-3 text-balance text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-[34px] md:text-[44px] ${
              isAr ? 'font-arabic' : ''
            }`}
          >
            {m.builtFor.title}
          </h2>
          <p className={`mt-3 max-w-xl text-[14.5px] text-neutral-400 sm:mt-4 sm:text-[15px] ${isAr ? 'font-arabic' : ''}`}>
            {m.builtFor.subtitle}
          </p>

          <ul className="mt-6 space-y-3 sm:mt-8 sm:space-y-3.5">
            {m.builtFor.items.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-400/10 ring-1 ring-brand-400/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                </span>
                <span className={`text-[14px] leading-relaxed text-neutral-200 sm:text-[15px] ${isAr ? 'font-arabic' : ''}`}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Map-like decorative panel */}
        <div className="relative aspect-square w-full max-w-md justify-self-center overflow-hidden rounded-xl border border-white/10 bg-[rgb(var(--surface-2))] sm:rounded-2xl">
          <MapGrid />
          <Marker label="UAE North" top="44%" left="54%" pulse />
          <Marker label="Riyadh" top="56%" left="42%" />
          <Marker label="Doha" top="48%" left="48%" />
          <Marker label="Manama" top="46%" left="49%" />
          <Marker label="Kuwait" top="38%" left="39%" />
          <Marker label="Muscat" top="58%" left="62%" />

          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500" dir="ltr">
            <span>Region · UAE North</span>
            <span className="text-emerald-400">● online</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function MapGrid() {
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full opacity-40" aria-hidden>
      <defs>
        <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
          <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.2" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#grid)" />
      {/* stylized coastline */}
      <path
        d="M 20 50 Q 35 35 48 38 Q 55 40 60 48 Q 66 56 58 62 Q 50 68 40 64 Q 28 60 24 56 Z"
        fill="rgba(45,212,191,0.06)"
        stroke="rgba(45,212,191,0.35)"
        strokeWidth="0.3"
      />
    </svg>
  );
}

function Marker({
  label,
  top,
  left,
  pulse,
}: {
  label: string;
  top: string;
  left: string;
  pulse?: boolean;
}) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ top, left }} dir="ltr">
      <div className="relative flex flex-col items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          {pulse ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-80" />
          ) : null}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              pulse ? 'bg-brand-400 shadow-[0_0_10px_rgba(45,212,191,0.9)]' : 'bg-white/60'
            }`}
          />
        </span>
        <span className="whitespace-nowrap rounded-md border border-white/10 bg-black/60 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-neutral-300 backdrop-blur-sm">
          {label}
        </span>
      </div>
    </div>
  );
}
