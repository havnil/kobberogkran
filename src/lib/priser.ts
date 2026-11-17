// Price helpers. Pure functions so tests can import them without Astro.
import type { Priser } from './firma';
import type { Locale } from '../i18n/locales';

/** Worked example from the price list: `timer` hours + service van per job + consumables (NOK incl. VAT, parts extra). */
export function regneeksempel(p: Priser, timer = 1): number {
  return timer * p.timepris.verdi + p.servicebil.verdi + p.forbruk.verdi;
}

/** `1 875 kr` (nb) / `1,875 kr` (en). */
export function formatKr(n: number, locale: Locale): string {
  return `${new Intl.NumberFormat(locale === 'nb' ? 'nb-NO' : 'en-GB').format(n)} kr`;
}

/** Cabin card text: August to November is `host` (closing for winter), the rest is `var` (opening for the season). */
export function aktivSesong(dato: Date): 'host' | 'var' {
  const maned = dato.getMonth(); // 0 = January
  return maned >= 7 && maned <= 10 ? 'host' : 'var';
}
