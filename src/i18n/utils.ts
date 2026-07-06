import en from './en.json';
import vi from './vi.json';

export const LOCALES = ['en', 'vi'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

const dictionaries: Record<Locale, unknown> = { en, vi };

/**
 * Returns a translator `t('a.b.c')` for the given locale.
 * Falls back to the key itself if a path is missing (surfaces gaps during dev).
 */
export function useTranslations(locale: Locale) {
  const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  return function t(key: string): string {
    const value = key.split('.').reduce<unknown>((obj, part) => {
      if (obj && typeof obj === 'object' && part in obj) {
        return (obj as Record<string, unknown>)[part];
      }
      return undefined;
    }, dict);
    return typeof value === 'string' ? value : key;
  };
}
