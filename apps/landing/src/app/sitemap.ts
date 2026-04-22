import type { MetadataRoute } from 'next';
import { LOCALES } from '@/lib/i18n';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://code.ae';
  return LOCALES.map((locale) => ({
    url: `${base}/${locale}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: locale === 'en' ? 1.0 : 0.9,
    alternates: {
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}`])),
    },
  }));
}
