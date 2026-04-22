import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a0a0a',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://code.ae'),
  title: {
    default: 'Code.ae — Build software in Arabic',
    template: '%s · Code.ae',
  },
  description:
    'The AI coding studio for Arabic speakers. Prompt in Arabic, ship production TypeScript, deploy to Vercel. Built for the Gulf.',
  openGraph: {
    title: 'Code.ae — Build software in Arabic',
    description:
      'The AI coding studio for Arabic speakers. Prompt in Arabic, ship production TypeScript, deploy to Vercel. Built for the Gulf.',
    url: 'https://code.ae',
    siteName: 'Code.ae',
    locale: 'en_AE',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Code.ae', description: 'Build software. In Arabic.' },
  icons: { icon: '/favicon.svg' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
