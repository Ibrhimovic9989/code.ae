import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LOCALE_DIRECTION, SUPPORTED_LOCALES, type Locale } from '@code-ae/shared';
import { AuthProvider } from '../../lib/auth-context';
import { Header } from '../../components/header';
import '../globals.css';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = LOCALE_DIRECTION[locale as Locale];

  return (
    <html lang={locale} dir={dir}>
      <body className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-50">
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <Header locale={locale as Locale} />
            {children}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
