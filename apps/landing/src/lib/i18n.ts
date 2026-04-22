import en from '@/messages/en.json';
import ar from '@/messages/ar.json';

export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const DIR: Record<Locale, 'ltr' | 'rtl'> = { en: 'ltr', ar: 'rtl' };

const dictionaries = { en, ar } as const;

export type Messages = typeof en;

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale] as Messages;
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
