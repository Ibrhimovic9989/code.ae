'use client';

import { useEffect, useState } from 'react';
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
  const [open, setOpen] = useState(false);

  // Close the mobile drawer on route change (approximate via location hash) + ESC.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 hairline-b backdrop-blur-xl bg-[rgb(var(--surface))]/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 md:px-8">
        <Link href={`/${locale}`} className="group flex items-center gap-2" dir="ltr">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight text-white">code.ae</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          <NavLink href={`/${locale}#features`}>{m.nav.features}</NavLink>
          <NavLink href={`/${locale}#how`}>{m.nav.how}</NavLink>
          <NavLink href={`/${locale}#pricing`}>{m.nav.pricing}</NavLink>
        </nav>

        {/* Desktop right rail */}
        <div className="hidden items-center gap-1.5 md:flex">
          <Link
            href={`/${otherLocale}`}
            className="rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-[12px] font-medium text-neutral-300 transition-colors hover:border-white/25 hover:text-white"
          >
            {otherLabel}
          </Link>
          <Link
            href={`${AppUrl}/${locale}/login`}
            className="px-3 py-1.5 text-[13px] font-medium text-neutral-300 transition-colors hover:text-white"
          >
            {m.nav.signIn}
          </Link>
          <Link href={`${AppUrl}/${locale}/register`} className="btn-primary">
            {m.nav.start}
          </Link>
        </div>

        {/* Mobile: compact CTA + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            href={`${AppUrl}/${locale}/register`}
            className="inline-flex h-9 items-center rounded-md bg-white px-3 text-[13px] font-medium text-black"
          >
            {m.nav.start}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] text-neutral-300 active:bg-white/[0.06]"
          >
            {open ? (
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="md:hidden">
          <div className="hairline-t bg-[rgb(var(--surface))]/95 backdrop-blur-xl">
            <nav className="flex flex-col gap-1 px-4 py-4 sm:px-6">
              <DrawerLink href={`/${locale}#features`} onClick={() => setOpen(false)}>
                {m.nav.features}
              </DrawerLink>
              <DrawerLink href={`/${locale}#how`} onClick={() => setOpen(false)}>
                {m.nav.how}
              </DrawerLink>
              <DrawerLink href={`/${locale}#pricing`} onClick={() => setOpen(false)}>
                {m.nav.pricing}
              </DrawerLink>
              <div className="my-2 h-px bg-white/10" />
              <DrawerLink href={`${AppUrl}/${locale}/login`} onClick={() => setOpen(false)}>
                {m.nav.signIn}
              </DrawerLink>
              <DrawerLink href={`/${otherLocale}`} onClick={() => setOpen(false)}>
                {otherLabel}
              </DrawerLink>
            </nav>
          </div>
        </div>
      ) : null}
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

function DrawerLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex h-12 items-center rounded-md px-3 text-[15px] font-medium text-neutral-200 active:bg-white/[0.06]"
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
