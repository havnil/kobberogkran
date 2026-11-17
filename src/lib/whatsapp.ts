// WhatsApp link helpers. Plain TypeScript (no Astro imports): used at build time by
// WhatsAppKnapp.astro and, bundled, by the small client script that adds `?kilde=`.
import { waDigits } from './telefon';

/** `https://wa.me/<digits>?text=<encoded>`; no `?text=` when the text is empty. */
export function waLenke(nummer: string, tekst: string): string {
  const base = `https://wa.me/${waDigits(nummer)}`;
  return tekst ? `${base}?text=${encodeURIComponent(tekst)}` : base;
}

/** Source tag from the URL: lowercase, only a-z, 0-9 and `-`, max 40 characters. */
export function renKilde(verdi: string | null | undefined): string {
  return (verdi ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
}

const PLASSHOLDER = /\{(tjeneste|kilde)\}/g;

/**
 * Fills `{tjeneste}` and `{kilde}` in the greeting template.
 *
 * `[ ... ]` marks an optional segment. A segment that contains a placeholder is dropped entirely if any
 * placeholder inside it is empty; otherwise the brackets are removed and the placeholders filled.
 * Rules: segments do not nest (a bracket pair that contains another `[` or `]` is not a segment);
 * a bracket pair without a placeholder (such as the "[EN] " marker) and unbalanced brackets are literal text.
 * A placeholder outside a segment is simply replaced (empty becomes nothing). Whitespace is only
 * adjusted around a removed segment, and never across line breaks.
 */
export function fyllHilsen(mal: string, verdier: { tjeneste?: string; kilde?: string }): string {
  const verdi = (navn: string): string => (verdier[navn as 'tjeneste' | 'kilde'] ?? '').trim();
  const fyll = (tekst: string): string => tekst.replace(PLASSHOLDER, (_, navn: string) => verdi(navn));
  const ut = mal.replace(/([ 	]*)\[([^\[\]]*)\]([ 	]*)/g, (hele, for_: string, indre: string, etter: string) => {
    const navn = [...indre.matchAll(PLASSHOLDER)].map((m) => m[1]);
    if (navn.length === 0) return hele;
    if (navn.some((n) => verdi(n) === '')) return for_ && etter ? ' ' : '';
    return for_ + fyll(indre) + etter;
  });
  // Placeholders left outside segments (segments are already filled and contain none).
  return fyll(ut).trim();
}
