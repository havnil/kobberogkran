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

/**
 * Fills `{tjeneste}` and `{kilde}` in the greeting template. An empty value removes the placeholder
 * together with the word that introduces it ("med {tjeneste}", "Fra: {kilde}"), then tidies up
 * empty parentheses, doubled spaces and spaces before punctuation.
 */
export function fyllHilsen(mal: string, verdier: { tjeneste?: string; kilde?: string }): string {
  let ut = mal;
  for (const navn of ['tjeneste', 'kilde'] as const) {
    const verdi = (verdier[navn] ?? '').trim();
    ut = verdi
      ? ut.split(`{${navn}}`).join(verdi)
      : ut.replace(new RegExp(String.raw`(?:(?<![^\s(])\p{L}+:?\s+)?\{${navn}\}`, 'gu'), '');
  }
  return ut
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([.,!?;:)])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
