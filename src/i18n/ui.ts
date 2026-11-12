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
  /** Accessible names for the navigation landmarks. */
  hovedmeny: string;
  bunnlinje: string;
  /** Short menu labels. */
  nav: { tjenester: string; priser: string; omrader: string; om: string; kontakt: string };
  ring: string;
  whatsapp: string;
  /** Text of the request-form button. Placeholder until the owner picks the final wording. */
  skjemaKnapp: string;
  /** Accessible name of the button that opens the services submenu. */
  visUndermeny: string;
  meny: string;
  lukk: string;
  vilkar: string;
  personvern: string;
  /** Badges: the visible placeholder mark and the example testimonial mark. */
  plassholderMerke: string;
  eksempelMerke: string;
  /** Small tag on a drawn placeholder illustration. */
  illustrasjonMerke: string;
  /** Top banner on every page of a build that is not for launch (LAUNCH is not true). */
  utkastBanner: string;
  /** Footer line label: «Org.nr. <number> MVA». */
  orgnr: string;
  /** Breadcrumb navigation: accessible name and the first crumb. */
  brodsmuler: string;
  hjem: string;
}

export const ui: Record<Locale, UiStrings> = {
  nb: {
    switcherLabel: 'Velg språk',
    languageNames: { nb: 'Norsk', en: 'English' },
    notFoundTitle: 'Fant ikke siden',
    notFoundText: 'Siden du leter etter finnes ikke, eller den er flyttet.',
    notFoundHomeLink: 'Gå til forsiden',
    skipLink: 'Hopp til innholdet',
    hovedmeny: 'Hovedmeny',
    bunnlinje: 'Hurtigvalg',
    nav: { tjenester: 'Tjenester', priser: 'Priser', omrader: 'Områder', om: 'Om Eirik', kontakt: 'Kontakt' },
    ring: 'Ring',
    whatsapp: 'WhatsApp',
    skjemaKnapp: 'Send forespørsel',
    visUndermeny: 'Vis tjenester',
    meny: 'Meny',
    lukk: 'Lukk',
    vilkar: 'Vilkår',
    personvern: 'Personvern',
    plassholderMerke: 'Plassholder',
    eksempelMerke: 'Eksempel',
    illustrasjonMerke: 'Illustrasjon',
    utkastBanner: 'Utkast: tekster, priser og illustrasjoner er plassholdere og ikke godkjent.',
    orgnr: 'Org.nr.',
    brodsmuler: 'Brødsmuler',
    hjem: 'Hjem',
  },
  en: {
    switcherLabel: 'Choose language',
    languageNames: { nb: 'Norsk', en: 'English' },
    notFoundTitle: 'Page not found',
    notFoundText: 'The page you are looking for does not exist, or it has moved.',
    notFoundHomeLink: 'Go to the home page',
    skipLink: 'Skip to content',
    hovedmeny: 'Main menu',
    bunnlinje: 'Quick actions',
    nav: { tjenester: 'Services', priser: 'Prices', omrader: 'Areas', om: 'About Eirik', kontakt: 'Contact' },
    ring: 'Call',
    whatsapp: 'WhatsApp',
    skjemaKnapp: 'Send request',
    visUndermeny: 'Show services',
    meny: 'Menu',
    lukk: 'Close',
    vilkar: 'Terms',
    personvern: 'Privacy',
    plassholderMerke: 'Placeholder',
    eksempelMerke: 'Example',
    illustrasjonMerke: 'Illustration',
    utkastBanner: 'Draft: texts, prices and illustrations are placeholders and not approved.',
    orgnr: 'Org. no.',
    brodsmuler: 'Breadcrumbs',
    hjem: 'Home',
  },
};
