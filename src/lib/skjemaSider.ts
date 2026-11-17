// Sidene skjemaet sender kunden til, og lenken for å sende flere bilder senere. Delt mellom
// serveren (kvitteringen på melding) og nettleseren (kvitteringen på skjermen), så lenken er lik.

export type SkjemaLocale = 'nb' | 'en';

/** Stiene til sidene skjemaet sender kunden til. */
export const SIDER = {
  takk: { nb: '/takk/', en: '/en/thanks/' },
  sendBilder: { nb: '/send-bilder/', en: '/en/send-photos/' },
} as const;

/** `<base>/send-bilder/?id=…&token=…` (eller den engelske siden). `base` uten eller med skråstrek til slutt. */
export function sendBilderLenke(base: string, loc: SkjemaLocale, id: string, token: string): string {
  return `${base.replace(/\/+$/, '')}${SIDER.sendBilder[loc]}?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;
}

const VARIABEL = /\{[A-Za-z][A-Za-z0-9]*\}/g;

/**
 * Kvitteringsmalen (`tekster.kvittering`, en meldingsmal) delt for visning på skjermen: teksten før
 * og etter `{sendBilderLenke}`, der lenken settes inn. Andre variabler fjernes. Står ikke
 * `{sendBilderLenke}` i malen, er `harLenke` false og hele teksten ligger i `for`.
 */
export function delKvittering(mal: string): { for: string; etter: string; harLenke: boolean } {
  const i = mal.indexOf('{sendBilderLenke}');
  const rens = (t: string) => t.replace(VARIABEL, '');
  if (i < 0) return { for: rens(mal).trim(), etter: '', harLenke: false };
  return {
    for: rens(mal.slice(0, i)).trimStart(),
    etter: rens(mal.slice(i + '{sendBilderLenke}'.length)).trimEnd(),
    harLenke: true,
  };
}
