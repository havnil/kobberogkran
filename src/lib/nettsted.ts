// Nettstedets adresse. Én kilde for JSON-LD, lenker i meldinger til kunden og lenker i varselet
// til Eirik. Samme verdi som `site` i astro.config.mjs.

/** Produksjonsadressen, uten skråstrek til slutt. */
export const NETTSTED = 'https://kobberogkran.no';

/**
 * Grunnadressen for lenker: `NETTSTED_URL` fra miljøet (f.eks. en preview) når den er satt og ikke
 * tom, ellers produksjonsadressen. Aldri med skråstrek til slutt.
 */
export function nettstedUrl(env: { NETTSTED_URL?: string } | string | undefined): string {
  const verdi = typeof env === 'string' ? env : env?.NETTSTED_URL;
  return (verdi?.trim() || NETTSTED).replace(/\/+$/, '');
}
