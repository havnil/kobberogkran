// Structured data (schema.org JSON-LD). Plain TypeScript so tests can import it without Astro.
// Fields whose value is still a placeholder are left out, so placeholder copy never reaches search engines.
import type { Firma, Verdi } from './firma';
import type { Tjeneste } from './innhold';
import type { Locale } from '../i18n/locales';

export const SITE = 'https://kobberogkran.no';
export const FIRMA_ID = `${SITE}/#firma`;

/** Text that is still a working title (`PLASSHOLDER: ...` or `[EN] PLASSHOLDER: ...`). */
export function erPlassholderTekst(tekst: string): boolean {
  return tekst.includes('PLASSHOLDER');
}

/** Removes keys whose value is undefined. */
function ryddOpp<T extends Record<string, unknown>>(objekt: T): T {
  return Object.fromEntries(Object.entries(objekt).filter(([, v]) => v !== undefined)) as T;
}

/** The value of a company field, or undefined while it is a placeholder. */
function ekte(felt: Verdi<string>): string | undefined {
  return felt.plassholder ? undefined : felt.verdi;
}

/** The text, or undefined while it is a placeholder. */
function ekteTekst(tekst: string): string | undefined {
  return erPlassholderTekst(tekst) ? undefined : tekst;
}

export function orgJsonLd(firma: Firma, locale: Locale): object {
  const adresse = ekte(firma.adresse);
  const orgnr = ekte(firma.orgnr);
  return ryddOpp({
    '@context': 'https://schema.org',
    '@type': 'Plumber',
    '@id': FIRMA_ID,
    name: firma.juridiskNavn,
    url: locale === 'nb' ? `${SITE}/` : `${SITE}/en/`,
    telephone: ekte(firma.telefon),
    email: ekte(firma.epost),
    vatID: orgnr ? `NO${orgnr.replace(/\D/g, '')}MVA` : undefined,
    address: adresse ? { '@type': 'PostalAddress', streetAddress: adresse, addressCountry: 'NO' } : undefined,
    areaServed: firma.omrade.steder,
  });
}

export function serviceJsonLd(tjeneste: Tjeneste, url: string): object {
  return ryddOpp({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: ekteTekst(tjeneste.title),
    serviceType: ekteTekst(tjeneste.fagord),
    description: ekteTekst(tjeneste.kort),
    url,
    provider: { '@id': FIRMA_ID },
  });
}

export function breadcrumbJsonLd(trail: { name: string; url: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((ledd, i) => ryddOpp({ '@type': 'ListItem', position: i + 1, name: ekteTekst(ledd.name), item: ledd.url })),
  };
}

/** FAQPage mirroring the visible questions, or null when there is no real question to mirror. */
export function faqJsonLd(faq: { sporsmal: string; svar: string }[]): object | null {
  const ekteSpm = faq.filter((q) => !erPlassholderTekst(q.sporsmal) && !erPlassholderTekst(q.svar));
  if (ekteSpm.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: ekteSpm.map((q) => ({ '@type': 'Question', name: q.sporsmal, acceptedAnswer: { '@type': 'Answer', text: q.svar } })),
  };
}
