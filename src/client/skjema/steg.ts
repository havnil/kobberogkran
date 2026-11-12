// Steg 1 og steg 2 mot API-et (src/server/skjema.ts): lese skjemaet, sjekke feltene i nettleseren,
// og sende. Sjekkene følger serverens regler (`validerSteg1`), men serveren har siste ord.
import { GRENSER, normaliserOrgnr, normaliserTelefon, type Feilkode } from '../../server/validering';
import { stedFraInput } from './sted';

export type Data = Record<string, unknown>;
export type KlientFeilkode = Feilkode | 'nettverk';
export interface FeltFeil {
  felt: string;
  feil: KlientFeilkode;
}

const felt = (form: HTMLFormElement, navn: string): string => {
  const el = form.elements.namedItem(navn);
  if (!el) return '';
  if (el instanceof RadioNodeList) return el.value;
  return (el as HTMLInputElement).value ?? '';
};

/** JSON-kroppen til POST /api/foresporsel. `idemNokkel` lages i nettleseren, én gang per utfylling. */
export function lesSteg1(form: HTMLFormElement, idemNokkel: string): Data {
  return {
    tjeneste: felt(form, 'tjeneste'),
    hast: felt(form, 'hast'),
    sted: { tekst: felt(form, 'sted'), lat: felt(form, 'lat'), lon: felt(form, 'lon'), gnr: felt(form, 'gnr'), bnr: felt(form, 'bnr') },
    navn: felt(form, 'navn'),
    telefon: felt(form, 'telefon'),
    epost: felt(form, 'epost'),
    kundetype: felt(form, 'kundetype') || 'privat',
    firmanavn: felt(form, 'firmanavn'),
    orgnr: felt(form, 'orgnr'),
    kilde: felt(form, 'kilde'),
    honning: felt(form, 'honning'),
    locale: felt(form, 'locale') || 'nb',
    idemNokkel,
    turnstileToken: felt(form, 'cf-turnstile-response'),
  };
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Feilene i feltene kunden fyller ut, i skjemarekkefølge. Turnstile og nøkkelen sjekkes av serveren. */
export function sjekkSteg1(d: Data): FeltFeil[] {
  const feil: FeltFeil[] = [];
  if (!s(d.tjeneste)) feil.push({ felt: 'tjeneste', feil: 'mangler' });
  if (!s(d.hast)) feil.push({ felt: 'hast', feil: 'mangler' });
  const sted = stedFraInput((d.sted ?? {}) as Record<string, string>);
  if (!sted.ok) feil.push({ felt: 'sted', feil: sted.feil });
  const navn = s(d.navn);
  if (!navn) feil.push({ felt: 'navn', feil: 'mangler' });
  else if (navn.length > GRENSER.navn) feil.push({ felt: 'navn', feil: 'for_lang' });
  if (!s(d.telefon)) feil.push({ felt: 'telefon', feil: 'mangler' });
  else if (!normaliserTelefon(d.telefon)) feil.push({ felt: 'telefon', feil: 'ugyldig' });
  const epost = s(d.epost);
  if (epost && (epost.length > GRENSER.epost || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epost))) feil.push({ felt: 'epost', feil: 'ugyldig' });
  if (d.kundetype === 'bedrift') {
    const firmanavn = s(d.firmanavn);
    if (!firmanavn) feil.push({ felt: 'firmanavn', feil: 'mangler' });
    else if (firmanavn.length > GRENSER.firmanavn) feil.push({ felt: 'firmanavn', feil: 'for_lang' });
    if (!s(d.orgnr)) feil.push({ felt: 'orgnr', feil: 'mangler' });
    else if (!normaliserOrgnr(d.orgnr)) feil.push({ felt: 'orgnr', feil: 'ugyldig' });
  }
  return feil;
}

export type Svar<T> = ({ ok: true } & T) | { ok: false; feil: KlientFeilkode; felt?: string };

async function send<T>(url: string, init: RequestInit, fetchFn: typeof fetch): Promise<Svar<T>> {
  let r: Response;
  try {
    r = await fetchFn(url, init);
  } catch {
    return { ok: false, feil: 'nettverk' };
  }
  const json = (await r.json().catch(() => null)) as (T & { feil?: Feilkode; felt?: string }) | null;
  if (r.ok && json) return { ok: true, ...json };
  const ut: Svar<T> = { ok: false, feil: json?.feil ?? 'serverfeil' };
  if (json?.felt) ut.felt = json.felt;
  return ut;
}

export async function sendSteg1(d: Data, fetchFn: typeof fetch = fetch): Promise<Svar<{ id: string; token: string }>> {
  const r = await send<{ id: string; token: string }>(
    '/api/foresporsel',
    { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(d) },
    fetchFn,
  );
  return r.ok ? { ok: true, id: r.id, token: r.token } : r;
}

export async function sendSteg2(id: string, token: string, d: Data, fetchFn: typeof fetch = fetch): Promise<Svar<object>> {
  const r = await send<object>(
    `/api/foresporsel/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(d),
    },
    fetchFn,
  );
  return r.ok ? { ok: true } : r;
}

/** Nøkkelen i `tekster.skjema.feil` for en feilkode. */
export function feilNokkel(kode: string): 'mangler' | 'ugyldig' | 'forLang' | 'turnstile' | 'nettverk' | 'server' {
  switch (kode) {
    case 'mangler':
    case 'ugyldig':
    case 'turnstile':
    case 'nettverk':
      return kode;
    case 'for_lang':
      return 'forLang';
    default:
      return 'server';
  }
}
