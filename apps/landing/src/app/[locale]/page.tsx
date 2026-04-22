import { notFound } from 'next/navigation';
import { getMessages, isLocale } from '@/lib/i18n';
import { Nav } from '@/components/nav';
import { Hero } from '@/components/hero';
import { StackMarquee } from '@/components/stack-marquee';
import { Features } from '@/components/features';
import { HowItWorks } from '@/components/how-it-works';
import { BuiltFor } from '@/components/built-for';
import { CTA } from '@/components/cta';
import { Footer } from '@/components/footer';

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);

  return (
    <>
      <Nav locale={locale} messages={messages} />
      <main>
        <Hero locale={locale} messages={messages} />
        <StackMarquee messages={messages} />
        <Features locale={locale} messages={messages} />
        <HowItWorks locale={locale} messages={messages} />
        <BuiltFor locale={locale} messages={messages} />
        <CTA locale={locale} messages={messages} />
      </main>
      <Footer locale={locale} messages={messages} />
    </>
  );
}
