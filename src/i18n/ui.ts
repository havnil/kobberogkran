import type { Locale } from './locales';

export interface UiStrings {
  /** Accessible label for the language switcher navigation. */
  switcherLabel: string;
  /** Name of each language, written in that language. */
  languageNames: Record<Locale, string>;
  notFoundTitle: string;
  notFoundText: string;
  notFoundHomeLink: string;
  skipLink: string;
}

export const ui: Record<Locale, UiStrings> = {
  nb: {
    switcherLabel: 'Velg språk',
    languageNames: { nb: 'Norsk', en: 'English' },
    notFoundTitle: 'Fant ikke siden',
    notFoundText: 'Siden du leter etter finnes ikke, eller den er flyttet.',
    notFoundHomeLink: 'Gå til forsiden',
    skipLink: 'Hopp til innholdet',
  },
  en: {
    switcherLabel: 'Choose language',
    languageNames: { nb: 'Norsk', en: 'English' },
    notFoundTitle: 'Page not found',
    notFoundText: 'The page you are looking for does not exist, or it has moved.',
    notFoundHomeLink: 'Go to the home page',
    skipLink: 'Skip to content',
  },
};
