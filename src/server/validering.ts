// Validering for skjemaets API (oppgave 7). Konstantene her er kontrakten mot klienten (oppgave 8).
//
// Feilsvar har alltid formen `{ feil: Feilkode, felt?: string }`. `feil` er en fast kode, ikke tekst
// til kunden: klienten viser godkjent tekst for koden ved feltet (tekst skrives av mennesker).

/** Tjenestene i skjemaet (`tjeneste`). Samme nøkler som tjenestesidene (translationKey), pluss «annet». */
export const TJENESTER = ['service-og-reparasjon', 'varmtvannstank', 'bronn-og-vann', 'hytte', 'bad', 'annet'] as const;
export type TjenesteNokkel = (typeof TJENESTER)[number];

/** «Det lekker nå», «snart» og «kan planlegges» (`hast`). */
export const HAST = ['lekker-naa', 'snart', 'kan-planlegges'] as const;
export type Hast = (typeof HAST)[number];

/** Privatkunde er forhåndsvalgt. Bedrift krever `firmanavn` og `orgnr`. */
export const KUNDETYPER = ['privat', 'bedrift'] as const;
export type Kundetype = (typeof KUNDETYPER)[number];

export const LOCALES = ['nb', 'en'] as const;
export type SkjemaLocale = (typeof LOCALES)[number];

/** Største lengde (tegn) på tekstfeltene. */
export const GRENSER = {
  navn: 200,
  firmanavn: 200,
  epost: 254,
  sted: 300,
  beskrivelse: 4000,
  kilde: 40,
  hvorHorte: 40,
  merke: 40,
  turnstileToken: 2048,
  /** Tekstverdi i `felles` og `tjenesteSvar`. */
  svarVerdi: 1000,
  /** Antall nøkler i `felles` og `tjenesteSvar`. */
  svarNokler: 50,
  /** Antall elementer i en liste-verdi i `felles` og `tjenesteSvar`, og lengden på hvert. */
  svarListe: 20,
  svarListeVerdi: 200,
} as const;

/** `idemNokkel`: tilfeldig nøkkel fra klienten (f.eks. `crypto.randomUUID()`), laget én gang per skjema. */
export const IDEM_NOKKEL = /^[A-Za-z0-9_-]{16,100}$/;

export const MAKS_BILDE_BYTES = 10 * 1024 * 1024;
export const MAKS_BILDER = 8;
export const BILDETYPER = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
export type Bildetype = (typeof BILDETYPER)[number];

export type Feilkode =
  | 'mangler'
  | 'ugyldig'
  | 'for_lang'
  | 'ugyldig_kropp'
  | 'for_stor'
  | 'for_mange'
  | 'feil_type'
  | 'avbrutt'
  | 'konflikt'
  | 'lukket'
  | 'turnstile'
  | 'uautorisert'
  | 'ikke_funnet'
  | 'ikke_konfigurert'
  | 'utilgjengelig'
  | 'serverfeil';

export interface Feil {
  feil: Feilkode;
  felt?: string;
}

/**
 * Feilsvaret fra API-et. `telefon` er firmaets telefonnummer slik det vises (fra firmadata), fordi
 * feilmeldinger alltid skal inneholde telefonnummeret (spesifikasjonen, «Skjemaet»).
 */
export interface FeilSvar extends Feil {
  telefon: string;
}

type Resultat<T> = { ok: true; data: T } | ({ ok: false } & Feil);
const feil = (kode: Feilkode, felt?: string): { ok: false } & Feil => (felt ? { ok: false, feil: kode, felt } : { ok: false, feil: kode });

/**
 * Norske nummer til E.164 (`+47XXXXXXXX`), ellers null. Godtar mellomrom, bindestrek, punktum og
 * parenteser, og prefiksene `+47`, `0047` og `47` (når nummeret da har 10 sifre).
 */
export function normaliserTelefon(verdi: unknown): string | null {
  if (typeof verdi !== 'string') return null;
  const s = verdi.trim().replace(/[\s\-().]/g, '');
  const m = /^(?:\+47|0047|47(?=\d{8}$))?(\d{8})$/.exec(s);
  if (!m || !/^[2-9]/.test(m[1])) return null;
  return `+47${m[1]}`;
}

/**
 * Organisasjonsnummer (9 sifre, mellomrom tillatt) med kontrollsiffer etter modulus 11 og vektene
 * 3, 2, 7, 6, 5, 4, 3, 2. Returnerer de 9 sifrene, eller null når nummeret er ugyldig.
 */
export function normaliserOrgnr(verdi: unknown): string | null {
  if (typeof verdi !== 'string' && typeof verdi !== 'number') return null;
  const s = String(verdi).replace(/\s/g, '');
  if (!/^\d{9}$/.test(s)) return null;
  const vekter = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = vekter.reduce((acc, v, i) => acc + v * Number(s[i]), 0);
  const rest = sum % 11;
  const kontroll = rest === 0 ? 0 : 11 - rest;
  if (kontroll === 10 || kontroll !== Number(s[8])) return null;
  return s;
}

/** Kilde (f.eks. `tapt-anrop`): små bokstaver, bare [a-z0-9-], maks 40. Tom eller ugyldig gir null. */
export function rensKilde(verdi: unknown): string | null {
  if (typeof verdi !== 'string') return null;
  const ren = verdi.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, GRENSER.kilde);
  return ren || null;
}

const tekst = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const erObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const SLUG = /^[a-z0-9-]{1,40}$/;

function tall(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export interface Steg1 {
  tjeneste: TjenesteNokkel;
  hast: Hast;
  navn: string;
  /** E.164 */
  telefon: string;
  epost: string | null;
  kilde: string | null;
  kundetype: Kundetype;
  /** Bare for bedrift. */
  firmanavn: string | null;
  /** Bare for bedrift: 9 sifre uten mellomrom. */
  orgnr: string | null;
  /** Fritekst, eventuelt med gårds- og bruksnummer. Null når bare koordinatene er gitt. */
  stedTekst: string | null;
  lat: number | null;
  lon: number | null;
  idemNokkel: string | null;
  turnstileToken: string;
  locale: SkjemaLocale;
}

/**
 * Validerer steg 1. `idemNokkel` kreves fra JSON-klienter (`kreverIdem`); et skjema uten JavaScript
 * kan mangle den. Rekkefølgen bestemmer hvilket felt som meldes først.
 */
export function validerSteg1(raw: Record<string, unknown>, kreverIdem = true): Resultat<Steg1> {
  const locale: SkjemaLocale = raw.locale === 'en' ? 'en' : 'nb';

  const tjeneste = tekst(raw.tjeneste);
  if (!tjeneste) return feil('mangler', 'tjeneste');
  if (!(TJENESTER as readonly string[]).includes(tjeneste)) return feil('ugyldig', 'tjeneste');

  const hast = tekst(raw.hast);
  if (!hast) return feil('mangler', 'hast');
  if (!(HAST as readonly string[]).includes(hast)) return feil('ugyldig', 'hast');

  // Sted: fritekst, koordinater eller gårds- og bruksnummer. Minst ett av dem.
  const stedRaw: Record<string, unknown> = typeof raw.sted === 'string' ? { tekst: raw.sted } : erObjekt(raw.sted) ? raw.sted : {};
  const stedFri = tekst(stedRaw.tekst);
  if (stedFri.length > GRENSER.sted) return feil('for_lang', 'sted');
  let lat: number | null = null;
  let lon: number | null = null;
  if (stedRaw.lat != null && stedRaw.lat !== '' || stedRaw.lon != null && stedRaw.lon !== '') {
    lat = tall(stedRaw.lat);
    lon = tall(stedRaw.lon);
    if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return feil('ugyldig', 'sted');
  }
  let gnrBnr = '';
  if (stedRaw.gnr != null && stedRaw.gnr !== '' || stedRaw.bnr != null && stedRaw.bnr !== '') {
    const gnr = tall(stedRaw.gnr);
    const bnr = tall(stedRaw.bnr);
    const gyldig = (n: number | null) => n != null && Number.isInteger(n) && n >= 1 && n <= 99999;
    if (!gyldig(gnr) || !gyldig(bnr)) return feil('ugyldig', 'sted');
    gnrBnr = `gnr. ${gnr}, bnr. ${bnr}`;
  }
  const stedTekst = [stedFri, gnrBnr].filter(Boolean).join(', ') || null;
  if (!stedTekst && lat == null) return feil('mangler', 'sted');

  const navn = tekst(raw.navn);
  if (!navn) return feil('mangler', 'navn');
  if (navn.length > GRENSER.navn) return feil('for_lang', 'navn');

  if (raw.telefon == null || tekst(raw.telefon) === '') return feil('mangler', 'telefon');
  const telefon = normaliserTelefon(raw.telefon);
  if (!telefon) return feil('ugyldig', 'telefon');

  const epost = tekst(raw.epost) || null;
  if (epost && (epost.length > GRENSER.epost || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epost))) return feil('ugyldig', 'epost');

  const kundetypeRaw = tekst(raw.kundetype) || 'privat';
  if (!(KUNDETYPER as readonly string[]).includes(kundetypeRaw)) return feil('ugyldig', 'kundetype');
  const kundetype = kundetypeRaw as Kundetype;
  let firmanavn: string | null = null;
  let orgnr: string | null = null;
  if (kundetype === 'bedrift') {
    firmanavn = tekst(raw.firmanavn);
    if (!firmanavn) return feil('mangler', 'firmanavn');
    if (firmanavn.length > GRENSER.firmanavn) return feil('for_lang', 'firmanavn');
    if (tekst(String(raw.orgnr ?? '')) === '') return feil('mangler', 'orgnr');
    orgnr = normaliserOrgnr(raw.orgnr);
    if (!orgnr) return feil('ugyldig', 'orgnr');
  }

  const idem = tekst(raw.idemNokkel) || null;
  if (idem ? !IDEM_NOKKEL.test(idem) : kreverIdem) return feil(idem ? 'ugyldig' : 'mangler', 'idemNokkel');

  const turnstileToken = tekst(raw.turnstileToken);
  if (!turnstileToken) return feil('mangler', 'turnstileToken');
  if (turnstileToken.length > GRENSER.turnstileToken) return feil('ugyldig', 'turnstileToken');

  return {
    ok: true,
    data: {
      tjeneste: tjeneste as TjenesteNokkel,
      hast: hast as Hast,
      navn,
      telefon,
      epost,
      kilde: rensKilde(raw.kilde),
      kundetype,
      firmanavn,
      orgnr,
      stedTekst,
      lat,
      lon,
      idemNokkel: idem,
      turnstileToken,
      locale,
    },
  };
}

export interface Steg2 {
  beskrivelse?: string;
  felles?: Record<string, SvarVerdi>;
  tjenesteSvar?: Record<string, SvarVerdi>;
  hvorHorte?: string;
  samtykker: { whatsapp?: boolean; paaminnelser?: boolean };
}

export type SvarVerdi = string | number | boolean | null | string[];

function validerSvar(v: unknown): Record<string, SvarVerdi> | null {
  if (!erObjekt(v)) return null;
  const nokler = Object.keys(v);
  if (nokler.length > GRENSER.svarNokler) return null;
  const ut: Record<string, SvarVerdi> = {};
  for (const k of nokler) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(k)) return null;
    const x = v[k];
    if (typeof x === 'string') {
      if (x.length > GRENSER.svarVerdi) return null;
      ut[k] = x;
    } else if (typeof x === 'number') {
      if (!Number.isFinite(x)) return null;
      ut[k] = x;
    } else if (typeof x === 'boolean' || x === null) {
      ut[k] = x;
    } else if (Array.isArray(x)) {
      if (x.length > GRENSER.svarListe || !x.every((e) => typeof e === 'string' && e.length <= GRENSER.svarListeVerdi)) return null;
      ut[k] = x as string[];
    } else {
      return null;
    }
  }
  return ut;
}

/** Validerer steg 2. Alt er valgfritt; ukjente felt ignoreres. */
export function validerSteg2(raw: Record<string, unknown>): Resultat<Steg2> {
  const data: Steg2 = { samtykker: {} };
  if (raw.beskrivelse != null) {
    if (typeof raw.beskrivelse !== 'string') return feil('ugyldig', 'beskrivelse');
    const b = raw.beskrivelse.trim();
    if (b.length > GRENSER.beskrivelse) return feil('for_lang', 'beskrivelse');
    data.beskrivelse = b;
  }
  for (const felt of ['felles', 'tjenesteSvar'] as const) {
    if (raw[felt] == null) continue;
    const svar = validerSvar(raw[felt]);
    if (!svar) return feil('ugyldig', felt);
    data[felt] = svar;
  }
  if (raw.hvorHorte != null && raw.hvorHorte !== '') {
    if (typeof raw.hvorHorte !== 'string' || !SLUG.test(raw.hvorHorte)) return feil('ugyldig', 'hvorHorte');
    data.hvorHorte = raw.hvorHorte;
  }
  if (raw.samtykker != null) {
    if (!erObjekt(raw.samtykker)) return feil('ugyldig', 'samtykker');
    for (const type of ['whatsapp', 'paaminnelser'] as const) {
      const v = raw.samtykker[type];
      if (v === undefined) continue;
      if (typeof v !== 'boolean') return feil('ugyldig', 'samtykker');
      data.samtykker[type] = v;
    }
  }
  return { ok: true, data };
}

/** Bildemerke (f.eks. `typeskilt`, `tank`, `pumpe`): [a-z0-9-], maks 40. Ugyldig gir null. */
export function rensMerke(verdi: unknown): string | null {
  return typeof verdi === 'string' && SLUG.test(verdi) ? verdi : null;
}

/** Bildetypen ut fra de første bytene (ikke Content-Type, som klienten bestemmer), eller null. */
export function bildetype(b: Uint8Array): Bildetype | null {
  const ascii = (fra: number, til: number) => String.fromCharCode(...b.subarray(fra, til));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 4) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a)
    return 'image/png';
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  // HEIF/HEIC: ISO-BMFF med `ftyp` og et HEIF-merke (iPhone bruker heic/mif1).
  if (b.length >= 12 && ascii(4, 8) === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(ascii(8, 12)))
    return 'image/heic';
  return null;
}
