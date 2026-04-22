import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Tajawal } from 'next/font/google';
import { Toaster } from 'sonner';
import { LOCALE_DIRECTION, SUPPORTED_LOCALES, type Locale } from '@code-ae/shared';
import { AuthProvider } from '../../lib/auth-context';
import { ThemeProvider, themeBootstrapScript } from '../../lib/theme-context';
import { Header } from '../../components/header';
import '../globals.css';

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-tajawal',
  display: 'swap',
});

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
    <html
      lang={locale}
      dir={dir}
      className={`${GeistSans.variable} ${GeistMono.variable} ${tajawal.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function (regs) {
                  var hadSw = regs.length > 0;
                  regs.forEach(function (r) { r.unregister(); });
                  if ('caches' in window) {
                    caches.keys().then(function (keys) {
                      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
                    }).then(function () {
                      if (hadSw) location.reload();
                    });
                  } else if (hadSw) {
                    location.reload();
                  }
                });
              }
            `,
          }}
        />
      </head>
      <body className="relative min-h-screen bg-[rgb(var(--surface-0))] text-neutral-100 antialiased">
        {/* Decorative global backdrop — matches landing */}
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[60vh] bg-dots mask-fade-bottom opacity-40" />
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <AuthProvider>
              <Header locale={locale as Locale} />
              {children}
              <Toaster
                position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'}
                dir={dir}
                theme="dark"
                closeButton
                toastOptions={{ duration: 3500 }}
              />
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
