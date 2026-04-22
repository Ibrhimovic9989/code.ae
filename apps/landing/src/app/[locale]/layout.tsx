import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { DIR, LOCALES, getMessages, isLocale, type Locale } from '@/lib/i18n';

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-arabic',
  display: 'swap',
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const m = getMessages(locale);
  return {
    title: m.meta.title,
    description: m.meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages: { en: '/en', ar: '/ar' },
    },
    openGraph: {
      title: m.meta.title,
      description: m.meta.description,
      locale: locale === 'ar' ? 'ar_AE' : 'en_AE',
      alternateLocale: locale === 'ar' ? 'en_AE' : 'ar_AE',
      type: 'website',
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dir = DIR[locale as Locale];

  return (
    <div
      lang={locale}
      dir={dir}
      className={`${arabic.variable} ${locale === 'ar' ? 'font-arabic' : 'font-sans'} relative min-h-screen overflow-x-hidden`}
    >
      {/* Decorative global backdrop — never interactive */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[rgb(var(--surface))]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[70vh] bg-dots mask-fade-bottom opacity-60"
      />
      {children}
    </div>
  );
}
