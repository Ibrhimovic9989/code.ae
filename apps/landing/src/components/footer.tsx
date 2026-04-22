import Link from 'next/link';
import type { Locale, Messages } from '@/lib/i18n';

export function Footer({ locale, messages: m }: { locale: Locale; messages: Messages }) {
  return (
    <footer className="hairline-t py-14">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-5 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href={`/${locale}`} className="flex items-center gap-2" dir="ltr">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/5 ring-1 ring-white/10">
              <svg viewBox="0 0 20 20" className="h-3 w-3 text-brand-400" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M7 5L3 10l4 5M13 5l4 5-4 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-[14px] font-semibold text-white">code.ae</span>
          </Link>
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-neutral-500">{m.footer.tag}</p>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-600" dir="ltr">
            {m.footer.copyright}
          </p>
        </div>

        <FooterGroup title={m.footer.product} links={m.footer.productLinks} locale={locale} />
        <FooterGroup title={m.footer.company} links={m.footer.companyLinks} locale={locale} />
        <FooterGroup title={m.footer.legal} links={m.footer.legalLinks} locale={locale} />
      </div>
    </footer>
  );
}

function FooterGroup({
  title,
  links,
  locale,
}: {
  title: string;
  links: Record<string, string>;
  locale: Locale;
}) {
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{title}</div>
      <ul className="mt-4 space-y-2.5">
        {Object.entries(links).map(([key, label]) => (
          <li key={key}>
            <Link
              href={`/${locale}#${key}`}
              className="text-[13.5px] text-neutral-300 transition-colors hover:text-white"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
