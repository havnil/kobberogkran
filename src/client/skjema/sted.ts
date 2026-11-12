// Hvor jobben er (steg 1): adresseforslag fra Kartverket, «Bruk der jeg er nå» (punktsøk), eller
// fritekst og gårds- og bruksnummer for hytter uten adresse. Samme regler som serveren
// (`validerSteg1` i src/server/validering.ts): minst ett av tekst, koordinater eller gnr/bnr.
//
// Adressesøket sender bare det kunden skriver i adressefeltet til Kartverket (ws.geonorge.no). Feiler
// søket, lukkes forslagslisten stille, og fritekst virker som før.
import { GRENSER } from '../../server/validering';

/** Aurskog-Høland og Lillestrøm. Søket tar én kommune per kall, så det blir ett kall per kommune. */
export const KOMMUNER = ['3226', '3205'] as const;
const API = 'https://ws.geonorge.no/adresser/v1';
const TREFF_PER_KOMMUNE = 5;
export const MIN_TEGN = 3;
export const VENT_MS = 250;

export interface StedInput {
  tekst?: string | null;
  lat?: string | number | null;
  lon?: string | number | null;
  gnr?: string | number | null;
  bnr?: string | number | null;
}

export interface Sted {
  tekst?: string;
  lat?: number;
  lon?: number;
  gnr?: number;
  bnr?: number;
}

export type StedResultat = { ok: true; sted: Sted } | { ok: false; feil: 'mangler' | 'ugyldig' | 'for_lang' };

const tom = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '');
function tall(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Stedet fra feltene, eller hvorfor det ikke holder. Hytte med bare fritekst er gyldig. */
export function stedFraInput(i: StedInput): StedResultat {
  const sted: Sted = {};
  const tekst = typeof i.tekst === 'string' ? i.tekst.trim() : '';
  if (tekst.length > GRENSER.sted) return { ok: false, feil: 'for_lang' };
  if (tekst) sted.tekst = tekst;

  if (!tom(i.lat) || !tom(i.lon)) {
    const lat = tall(i.lat);
    const lon = tall(i.lon);
    if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return { ok: false, feil: 'ugyldig' };
    sted.lat = lat;
    sted.lon = lon;
  }
  if (!tom(i.gnr) || !tom(i.bnr)) {
    const gnr = tall(i.gnr);
    const bnr = tall(i.bnr);
    const gyldig = (n: number | null): n is number => n != null && Number.isInteger(n) && n >= 1 && n <= 99999;
    if (!gyldig(gnr) || !gyldig(bnr)) return { ok: false, feil: 'ugyldig' };
    sted.gnr = gnr;
    sted.bnr = bnr;
  }
  if (Object.keys(sted).length === 0) return { ok: false, feil: 'mangler' };
  return { ok: true, sted };
}

export interface Adresseforslag {
  tekst: string;
  lat: number;
  lon: number;
}

/** Ett søk per kommune. `*` gir treff på begynnelsen av ordet mens kunden skriver. */
export function sokUrler(tekst: string): string[] {
  return KOMMUNER.map((k) => {
    const p = new URLSearchParams({ sok: `${tekst.trim()}*`, kommunenummer: k, treffPerSide: String(TREFF_PER_KOMMUNE), utkoordsys: '4258' });
    return `${API}/sok?${p}`;
  });
}

export function punktsokUrl(lat: number, lon: number): string {
  const p = new URLSearchParams({ lat: String(lat), lon: String(lon), radius: '200', treffPerSide: '1', utkoordsys: '4258' });
  return `${API}/punktsok?${p}`;
}

/** Adressene i et svar fra Kartverket. Adresser uten koordinater hoppes over. */
export function tolkAdresser(json: unknown): Adresseforslag[] {
  const liste = (json as { adresser?: unknown } | null)?.adresser;
  if (!Array.isArray(liste)) return [];
  const ut: Adresseforslag[] = [];
  for (const a of liste as Record<string, unknown>[]) {
    const punkt = a?.representasjonspunkt as { lat?: unknown; lon?: unknown } | undefined;
    const lat = tall(punkt?.lat);
    const lon = tall(punkt?.lon);
    const adr = typeof a?.adressetekst === 'string' ? a.adressetekst : '';
    if (!adr || lat == null || lon == null) continue;
    const post = [a.postnummer, a.poststed].filter((x) => typeof x === 'string' && x).join(' ');
    ut.push({ tekst: post ? `${adr}, ${post}` : adr, lat, lon });
  }
  return ut;
}

async function hentJson(url: string, signal: AbortSignal, fetchFn: typeof fetch): Promise<unknown> {
  const r = await fetchFn(url, { signal, headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`Kartverket ${r.status}`);
  return r.json();
}

/** Adresseforslag fra begge kommunene. Feil (også nettverk) gir en tom liste; avbrudd kastes videre. */
export async function sokAdresser(tekst: string, signal: AbortSignal, fetchFn: typeof fetch = fetch): Promise<Adresseforslag[]> {
  const svar = await Promise.allSettled(sokUrler(tekst).map((u) => hentJson(u, signal, fetchFn)));
  if (signal.aborted) throw new DOMException('Avbrutt', 'AbortError');
  const sett = new Set<string>();
  return svar
    .flatMap((s) => (s.status === 'fulfilled' ? tolkAdresser(s.value) : []))
    .filter((a) => !sett.has(a.tekst) && !!sett.add(a.tekst));
}

/** Nærmeste adresse til et punkt (for «Bruk der jeg er nå»), eller null. */
export async function adresseVed(lat: number, lon: number, signal?: AbortSignal, fetchFn: typeof fetch = fetch): Promise<Adresseforslag | null> {
  try {
    return tolkAdresser(await hentJson(punktsokUrl(lat, lon), signal ?? new AbortController().signal, fetchFn))[0] ?? null;
  } catch {
    return null;
  }
}

export interface AdressefeltValg {
  input: HTMLInputElement;
  liste: HTMLElement;
  lat: HTMLInputElement;
  lon: HTMLInputElement;
  sok?: (tekst: string, signal: AbortSignal) => Promise<Adresseforslag[]>;
  onVelg?: (a: Adresseforslag) => void;
}

/**
 * Kobler adressefeltet som en combobox (WAI-ARIA «combobox with listbox popup»): venter 250 ms etter
 * siste tastetrykk, søker fra 3 tegn, avbryter gamle søk, og lar kunden velge med piltaster, Enter,
 * Escape eller mus/berøring. Et valg fyller de skjulte koordinatfeltene; skriver kunden videre,
 * tømmes de.
 */
export function koblAdressefelt(v: AdressefeltValg): void {
  const { input, liste, lat, lon } = v;
  const sok = v.sok ?? ((t: string, s: AbortSignal) => sokAdresser(t, s));
  let forslag: Adresseforslag[] = [];
  let aktiv = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let kontroller: AbortController | undefined;
  const listeId = liste.id || 'sted-forslag';
  liste.id = listeId;

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', listeId);
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('autocomplete', 'off');
  liste.setAttribute('role', 'listbox');

  const lukk = () => {
    liste.hidden = true;
    liste.replaceChildren();
    forslag = [];
    aktiv = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const marker = (i: number) => {
    aktiv = i;
    liste.querySelectorAll('[role="option"]').forEach((el, j) => el.setAttribute('aria-selected', String(j === i)));
    if (i >= 0) {
      const id = `${listeId}-${i}`;
      input.setAttribute('aria-activedescendant', id);
      document.getElementById(id)?.scrollIntoView?.({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };

  const velg = (i: number) => {
    const a = forslag[i];
    if (!a) return;
    input.value = a.tekst;
    lat.value = String(a.lat);
    lon.value = String(a.lon);
    lukk();
    v.onVelg?.(a);
  };

  const vis = (nye: Adresseforslag[]) => {
    forslag = nye;
    aktiv = -1;
    liste.replaceChildren(
      ...nye.map((a, i) => {
        const li = document.createElement('li');
        li.id = `${listeId}-${i}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.textContent = a.tekst;
        // mousedown: velg før feltet mister fokus.
        li.addEventListener('mousedown', (e) => {
          e.preventDefault();
          velg(i);
        });
        return li;
      }),
    );
    const apen = nye.length > 0;
    liste.hidden = !apen;
    input.setAttribute('aria-expanded', String(apen));
    input.removeAttribute('aria-activedescendant');
  };

  input.addEventListener('input', () => {
    // Endret tekst: koordinatene fra et tidligere valg gjelder ikke lenger.
    lat.value = '';
    lon.value = '';
    clearTimeout(timer);
    kontroller?.abort();
    const tekst = input.value.trim();
    if (tekst.length < MIN_TEGN) {
      lukk();
      return;
    }
    timer = setTimeout(async () => {
      const k = new AbortController();
      kontroller = k;
      try {
        const nye = await sok(tekst, k.signal);
        if (!k.signal.aborted) vis(nye);
      } catch {
        if (!k.signal.aborted) lukk();
      }
    }, VENT_MS);
  });

  input.addEventListener('keydown', (e) => {
    const apen = !liste.hidden && forslag.length > 0;
    if (e.key === 'ArrowDown' && apen) {
      e.preventDefault();
      marker((aktiv + 1) % forslag.length);
    } else if (e.key === 'ArrowUp' && apen) {
      e.preventDefault();
      marker(aktiv <= 0 ? forslag.length - 1 : aktiv - 1);
    } else if (e.key === 'Enter' && apen && aktiv >= 0) {
      // Bare når et forslag er markert; ellers sendes skjemaet som vanlig.
      e.preventDefault();
      velg(aktiv);
    } else if (e.key === 'Escape' && apen) {
      e.preventDefault();
      lukk();
    }
  });

  input.addEventListener('blur', () => setTimeout(lukk, 0));
}
