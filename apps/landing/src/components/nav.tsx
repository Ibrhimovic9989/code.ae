import Link from 'next/link';
import type { Locale, Messages } from '@/lib/i18n';
import { AppUrl } from '@/lib/app-url';

interface Props {
  locale: Locale;
  messages: Messages;
}

export function Nav({ locale, messages: m }: Props) {
  const otherLocale = locale === 'en' ? 'ar' : 'en';
  const otherLabel = locale === 'en' ? 'العربية' : 'English';
  return (
    <header className="sticky top-0 z-40 hairline-b backdrop-blur-xl bg-[rgb(var(--surface))]/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href={`/${locale}`} className="group flex items-center gap-2" dir="ltr">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight text-white">code.ae</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink href={`/${locale}#features`}>{m.nav.features}</NavLink>
          <NavLink href={`/${locale}#how`}>{m.nav.how}</NavLink>
          <NavLink href={`/${locale}#pricing`}>{m.nav.pricing}</NavLink>
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href={`/${otherLocale}`}
            className="hidden rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-[12px] font-medium text-neutral-300 transition-colors hover:border-white/25 hover:text-white md:inline-flex"
          >
            {otherLabel}
          </Link>
          <Link
            href={`${AppUrl}/${locale}/login`}
            className="hidden px-3 py-1.5 text-[13px] font-medium text-neutral-300 transition-colors hover:text-white md:inline-flex"
          >
            {m.nav.signIn}
          </Link>
          <Link href={`${AppUrl}/${locale}/register`} className="btn-primary">
            {m.nav.start}
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-[13.5px] text-neutral-400 transition-colors hover:bg-white/[0.04] hover:text-white"
    >
      {children}
    </Link>
  );
}

function Logo() {
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.05] ring-1 ring-white/10 transition-colors group-hover:ring-white/25"
      aria-hidden
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-brand-400" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M7 5L3 10l4 5M13 5l4 5-4 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
