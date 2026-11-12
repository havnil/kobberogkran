// API-et for skjemaet (spesifikasjonen, «Skjemaet»; oppgave 7). Route-filene i src/pages/api henter
// bare env og waitUntil og kaller funksjonene her.
//
// - POST /api/foresporsel (steg 1): lagres straks, idempotent på `idemNokkel`. Gir `{ id, token }`.
//   Etter en ny forespørsel starter `waitUntil` sortering og varsel til Eirik, og den faste
//   kvitteringen til kunden (med lenke for å sende flere bilder senere). Kvitteringen lover aldri tid.
//   Et skjema uten JavaScript (urlencoded eller multipart) får 303 til takkesiden.
// - PATCH /api/foresporsel/:id (steg 2), med `Authorization: Bearer <token>`.
// - POST /api/bilde?id=…&token=… med bildet som kropp (image/*) eller multipart (feltet `bilde`).
// - GET /api/bilde/:id?utloper=…&sig=… for Eiriks signerte, tidsbegrensede bildelenker.
// Alle feilsvar er `{ feil, felt?, telefon }` (se validering.ts); `telefon` er firmaets nummer. Ingen sporing: ingen cookies, ingen IP lagres
// (IP-en går bare til Turnstile).
import type { D1Database } from '@cloudflare/workers-types';
import firmaJson from '../content/firma/firma.json';
import { firmaSchema } from '../lib/firma';
import { fjernJpegMetadata, fjernPngMetadata } from './bildemetadata';
import {
  antallBilder,
  finnForesporselForIdem,
  hentBildeNokkel,
  hentStatus,
  lagreSteg2,
  leggTilBildeMaks,
  leggTilBildeMerke,
  loggHendelse,
  opprettForesporsel,
  registrerSamtykke,
  sisteSamtykke,
  type ForesporselStatus,
} from './db';
import type { Env, Kontekst } from './env';
import { verifiserBildeLenke } from './bildelenke';
import { hendelseLogger, lagKanaler, sendMedReserve, type Kanal } from './kanaler/index';
import { lesBegrensetKropp } from './kropp';
import { sorterOgVarsle } from './sortering/index';
import type { Sorterer } from './sortering/ai';
import { loggTillegg, varsleTillegg } from './tillegg';
import { lagSkjemaToken, verifiserSkjemaToken } from './token';
import { verifiserTurnstile } from './turnstile';
import {
  bildetype,
  MAKS_BILDE_BYTES,
  MAKS_BILDER,
  rensMerke,
  validerSteg1,
  validerSteg2,
  type Feilkode,
  type SkjemaLocale,
} from './validering';
import type { Varsler } from './varsling';
import { nettstedUrl } from '../lib/nettsted';
import { SIDER, sendBilderLenke } from '../lib/skjemaSider';

export interface SkjemaDeps {
  kanaler?: Kanal[];
  varsler?: Varsler;
  sorterer?: Sorterer;
  turnstileFetch?: typeof fetch;
  naa?: () => Date;
  vent?: (ms: number) => Promise<void>;
}

/** Plass til multipart-grenser og -headere rundt bildet. */
const MULTIPART_TILLEGG = 64 * 1024;

export { SIDER };

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
/** Firmaets telefonnummer slik det vises. Står i alle feilsvar. */
export const FIRMA_TELEFON = firmaSchema.parse(firmaJson.firma).telefon.verdi;
const feilSvar = (status: number, feil: Feilkode, felt?: string) =>
  json(status, felt ? { feil, felt, telefon: FIRMA_TELEFON } : { feil, telefon: FIRMA_TELEFON });
const videre = (sted: string) => new Response(null, { status: 303, headers: { location: sted, 'cache-control': 'no-store' } });
const medFeil = (sti: string, feil: Feilkode, felt?: string) =>
  `${sti}${sti.includes('?') ? '&' : '?'}feil=${feil}${felt ? `&felt=${encodeURIComponent(felt)}` : ''}`;

const tilHex = (b: ArrayBuffer | Uint8Array) =>
  [...(b instanceof Uint8Array ? b : new Uint8Array(b))].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha256Hex = async (tekst: string) => tilHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tekst)));

/**
 * UUID (versjon 8, deterministisk) fra idempotensnøkkelen. Turnstile krever en UUID som
 * `idempotency_key`; samme nøkkel gir samme UUID, så et samtidig gjentak kan verifisere samme token
 * på nytt i stedet for å få `timeout-or-duplicate`.
 */
export async function turnstileIdempotens(idemNokkel: string): Promise<string> {
  const h = await sha256Hex(`turnstile:${idemNokkel}`);
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const tilfeldigHex = () => [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
const feiltekst = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

const innholdstype = (r: Request) => (r.headers.get('content-type') ?? '').toLowerCase();
const erSkjemaPost = (ct: string) => ct.startsWith('application/x-www-form-urlencoded') || ct.startsWith('multipart/form-data');

type Kropp = { ok: true; data: Record<string, unknown> } | { ok: false; status: number; feil: Feilkode };

/** Leser en JSON- eller skjemakropp på maks 64 KB. Filer i et multipart-skjema ignoreres. */
async function lesKropp(request: Request, ct: string): Promise<Kropp> {
  let raw: ArrayBuffer | null;
  try {
    raw = await lesBegrensetKropp(request);
  } catch {
    return { ok: false, status: 400, feil: 'avbrutt' };
  }
  if (!raw) return { ok: false, status: 413, feil: 'for_stor' };
  try {
    if (ct.startsWith('application/json')) {
      const v: unknown = JSON.parse(new TextDecoder().decode(raw));
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('ikke et objekt');
      return { ok: true, data: v as Record<string, unknown> };
    }
    if (erSkjemaPost(ct)) {
      const fd = await new Response(raw, { headers: { 'content-type': ct } }).formData();
      const data: Record<string, unknown> = {};
      for (const [k, v] of fd.entries()) if (typeof v === 'string') data[k] = v;
      return { ok: true, data };
    }
  } catch {
    return { ok: false, status: 400, feil: 'ugyldig_kropp' };
  }
  return { ok: false, status: 400, feil: 'ugyldig_kropp' };
}

/** Flate skjemafelt (uten JavaScript) til samme form som JSON-kroppen. */
function fraSkjema(f: Record<string, unknown>): Record<string, unknown> {
  return {
    ...f,
    turnstileToken: f.turnstileToken ?? f['cf-turnstile-response'],
    sted: { tekst: f.sted ?? f['sted.tekst'], lat: f.lat, lon: f.lon, gnr: f.gnr, bnr: f.bnr },
  };
}

const locale = (v: unknown): SkjemaLocale => (v === 'en' ? 'en' : 'nb');


// --- Steg 1 ---

export async function haandterSteg1(request: Request, env: Env, ctx: Kontekst, deps: SkjemaDeps = {}): Promise<Response> {
  const ct = innholdstype(request);
  const skjema = erSkjemaPost(ct);
  const kropp = await lesKropp(request, ct);
  const raw = kropp.ok ? (skjema ? fraSkjema(kropp.data) : kropp.data) : {};
  const loc = locale(raw.locale);
  const takk = SIDER.takk[loc];
  const avvis = (status: number, feil: Feilkode, felt?: string) =>
    skjema ? videre(medFeil(takk, feil, felt)) : feilSvar(status, feil, felt);
  if (!kropp.ok) return avvis(kropp.status, kropp.feil);

  // Honningfeltet: roboter får et vanlig svar, men ingenting lagres eller sendes.
  if (typeof raw.honning === 'string' && raw.honning.trim() !== '') {
    return skjema ? videre(takk) : json(201, { id: crypto.randomUUID(), token: tilfeldigHex() });
  }

  if (!env.DB || !env.SKJEMA_HMAC || !env.TURNSTILE_SECRET) {
    console.error(JSON.stringify({ hendelse: 'skjema_ikke_konfigurert' }));
    return avvis(503, 'ikke_konfigurert');
  }

  const v = validerSteg1(raw, !skjema);
  if (!v.ok) return avvis(400, v.feil, v.felt);
  const d = v.data;
  const svar = (status: number, id: string, token: string) => (skjema ? videre(takk) : json(status, { id, token }));

  try {
    // Et skjema uten JavaScript har ingen idemNokkel. Turnstile-tokenet er unikt per utfylling og
    // følger med når kunden dobbeltklikker eller sender på nytt, så nøkkelen avledes av det.
    const idem = d.idemNokkel ?? `skjema-${await sha256Hex(d.turnstileToken)}`;

    // Gjentak (dobbeltklikk, tilbake i nettleseren): samme svar, ingen ny rad, ingen ny kvittering.
    // Sjekkes før Turnstile, fordi Turnstile-tokenet er engangs og gjentaket har det samme tokenet.
    const tidligere = async (): Promise<Response | null> => {
      const finnes = await finnForesporselForIdem(env.DB, idem);
      if (!finnes) return null;
      if (finnes.telefon !== d.telefon) return avvis(409, 'konflikt', 'idemNokkel');
      return svar(200, finnes.id, await lagSkjemaToken(finnes.id, env.SKJEMA_HMAC!));
    };
    const gjentak = await tidligere();
    if (gjentak) return gjentak;

    // Samme idempotency_key lar et samtidig gjentak verifisere samme token på nytt.
    const ts = await verifiserTurnstile(d.turnstileToken, env.TURNSTILE_SECRET, {
      ip: request.headers.get('cf-connecting-ip'),
      idempotencyKey: await turnstileIdempotens(idem),
      fetch: deps.turnstileFetch,
    });
    if (ts !== 'ok') {
      // Avvist fordi den første innsendingen nettopp brukte tokenet: den er lagret, så svaret er det samme.
      const lagret = await tidligere();
      if (lagret) return lagret;
      return ts === 'feil' ? avvis(503, 'utilgjengelig') : avvis(403, 'turnstile', 'turnstileToken');
    }

    const { id, ny } = await opprettForesporsel(
      env.DB,
      {
        telefon: d.telefon,
        navn: d.navn,
        epost: d.epost ?? undefined,
        tjeneste: d.tjeneste,
        hast: d.hast,
        stedTekst: d.stedTekst ?? undefined,
        lat: d.lat ?? undefined,
        lon: d.lon ?? undefined,
        kilde: d.kilde ?? undefined,
        kundetype: d.kundetype,
        firmanavn: d.firmanavn ?? undefined,
        orgnr: d.orgnr ?? undefined,
      },
      idem,
    );
    const token = await lagSkjemaToken(id, env.SKJEMA_HMAC);
    if (ny) ctx.waitUntil(etterSteg1(env, id, d.telefon, loc, sendBilderLenke(nettstedUrl(env), loc, id, token), deps));
    return svar(ny ? 201 : 200, id, token);
  } catch (e) {
    console.error(JSON.stringify({ hendelse: 'steg1_feilet', feil: feiltekst(e) }));
    return avvis(500, 'serverfeil');
  }
}

/**
 * Etter en endring (steg 2, bilde eller samtykke). Er hovedvarselet ikke sendt ennå ('ny' eller
 * 'sortert', f.eks. fordi e-posten feilet), prøves det på nytt her; låsen i sorterOgVarsle gjør det
 * trygt mens en annen kjøring holder på. Deretter samles tillegg som vanlig (bare når 'varslet').
 * Kaster aldri.
 */
async function etterEndring(env: Env, id: string, status: ForesporselStatus, deps: SkjemaDeps): Promise<void> {
  if (status === 'ny' || status === 'sortert') {
    await sorterOgVarsle(env, id, { sorterer: deps.sorterer, varsler: deps.varsler, naa: deps.naa });
  }
  await varsleTillegg(env, id, { samle: true }, deps);
}

/**
 * Sortering og varsel til Eirik, og kvitteringen til kunden. Kaster aldri.
 * Kvitteringen og AI-sorteringen går samtidig; varselet venter på kvitteringen før det sendes, så
 * Eirik ser om kunden ikke fikk den (hendelsene 'melding_ingen_kanal' og 'melding_feilet').
 */
async function etterSteg1(env: Env, id: string, telefon: string, loc: SkjemaLocale, lenke: string, deps: SkjemaDeps): Promise<void> {
  const tillegg = { varsler: deps.varsler, sorterer: deps.sorterer, naa: deps.naa, vent: deps.vent };
  const kvittering = sendMedReserve(
    deps.kanaler ?? lagKanaler(env),
    telefon,
    { id: 'kvittering', locale: loc, variabler: { sendBilderLenke: lenke } },
    { logg: hendelseLogger(env.DB, id) },
  ).catch((e) => {
    console.error(JSON.stringify({ hendelse: 'kvittering_feilet', feil: feiltekst(e) }));
  });
  await Promise.all([
    sorterOgVarsle(env, id, { sorterer: deps.sorterer, varsler: deps.varsler, naa: deps.naa, kvittering })
      // Det som kom inn mens AI-en sorterte, sendes som tillegg rett etter varselet.
      .then(() => varsleTillegg(env, id, { samle: false }, tillegg)),
    kvittering,
  ]);
}

// --- Steg 2 ---

async function harTilgang(env: Env, id: string, token: string | null | undefined): Promise<boolean> {
  return !!token && !!env.SKJEMA_HMAC && verifiserSkjemaToken(id, token, env.SKJEMA_HMAC);
}

export async function haandterSteg2(
  request: Request,
  env: Env,
  ctx: Kontekst,
  id: string,
  deps: SkjemaDeps = {},
): Promise<Response> {
  if (!env.DB || !env.SKJEMA_HMAC) return feilSvar(503, 'ikke_konfigurert');
  const bearer = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!(await harTilgang(env, id, bearer))) return feilSvar(401, 'uautorisert');

  const ct = innholdstype(request);
  if (!ct.startsWith('application/json')) return feilSvar(400, 'ugyldig_kropp');
  const kropp = await lesKropp(request, ct);
  if (!kropp.ok) return feilSvar(kropp.status, kropp.feil);
  const v = validerSteg2(kropp.data);
  if (!v.ok) return feilSvar(400, v.feil, v.felt);
  const d = v.data;

  try {
    const f = await hentStatus(env.DB, id);
    if (!f) return feilSvar(404, 'ikke_funnet');
    if (f.status === 'lukket') return feilSvar(409, 'lukket');

    let endret = false;
    if (d.beskrivelse !== undefined || d.felles || d.tjenesteSvar || d.hvorHorte !== undefined) {
      await lagreSteg2(env.DB, id, d.beskrivelse, { felles: d.felles, tjenesteSvar: d.tjenesteSvar, hvorHorte: d.hvorHorte });
      await loggTillegg(env.DB, id, { hva: 'steg2' });
      endret = true;
    }
    for (const type of ['whatsapp', 'paaminnelser'] as const) {
      const gitt = d.samtykker[type];
      if (gitt === undefined) continue;
      // Samtykkehistorikken får en rad bare når valget endres.
      if ((await sisteSamtykke(env.DB, f.kundeId, type)) === gitt) continue;
      await registrerSamtykke(env.DB, f.kundeId, type, gitt, 'skjema');
      await loggTillegg(env.DB, id, { hva: 'samtykke', type, gitt });
      endret = true;
    }
    if (endret) ctx.waitUntil(etterEndring(env, id, f.status, deps));
    return json(200, { ok: true });
  } catch (e) {
    console.error(JSON.stringify({ hendelse: 'steg2_feilet', feil: feiltekst(e) }));
    return feilSvar(500, 'serverfeil');
  }
}

// --- Bildeopplasting ---

export async function haandterBildeOpplasting(
  request: Request,
  env: Env,
  ctx: Kontekst,
  deps: SkjemaDeps = {},
): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  const token = url.searchParams.get('token') ?? '';
  const ct = innholdstype(request);
  const multipart = ct.startsWith('multipart/form-data');
  const html = (request.headers.get('accept') ?? '').includes('text/html');
  let loc = locale(url.searchParams.get('locale'));
  let merke = rensMerke(url.searchParams.get('merke'));

  const tilbake = () => `${SIDER.sendBilder[loc]}?id=${encodeURIComponent(id)}&token=${token}`;
  const avvis = (status: number, feil: Feilkode, felt?: string) =>
    html && status !== 401 && status !== 503 ? videre(medFeil(tilbake(), feil, felt)) : feilSvar(status, feil, felt);

  if (!env.DB || !env.SKJEMA_HMAC || !env.BILDER) return feilSvar(503, 'ikke_konfigurert');
  if (!(await harTilgang(env, id, token))) return feilSvar(401, 'uautorisert');

  const db: D1Database = env.DB;
  let status: ForesporselStatus;
  try {
    const f = await hentStatus(db, id);
    if (!f) return feilSvar(404, 'ikke_funnet');
    status = f.status;
    if (f.status === 'lukket') return avvis(409, 'lukket');
    if ((await antallBilder(db, id)) >= MAKS_BILDER) return avvis(409, 'for_mange', 'bilde');
  } catch (e) {
    console.error(JSON.stringify({ hendelse: 'bilde_feilet', feil: feiltekst(e) }));
    return feilSvar(500, 'serverfeil');
  }

  // Grensen håndheves mens kroppen leses: for stor Content-Length avvises straks, og lesingen
  // stopper når strømmen passerer grensen. Kroppen holdes i minnet (maks ca. 10 MB) fordi typen
  // sjekkes på innholdet før noe lagres.
  const grense = MAKS_BILDE_BYTES + (multipart ? MULTIPART_TILLEGG : 0);
  let raw: ArrayBuffer | null;
  try {
    raw = await lesBegrensetKropp(request, grense);
  } catch {
    // Forbindelsen brøt (svak dekning). Forespørselen fra steg 1 står uendret.
    return avvis(400, 'avbrutt', 'bilde');
  }
  if (!raw) return avvis(413, 'for_stor', 'bilde');

  let bytes: Uint8Array<ArrayBuffer>;
  if (multipart) {
    let fd: FormData;
    try {
      fd = await new Response(raw, { headers: { 'content-type': ct } }).formData();
    } catch {
      return avvis(400, 'ugyldig_kropp');
    }
    loc = locale(fd.get('locale') ?? loc);
    merke = rensMerke(fd.get('merke')) ?? merke;
    const fil = fd.get('bilde');
    if (!fil || typeof fil === 'string') return avvis(400, 'mangler', 'bilde');
    bytes = new Uint8Array(await fil.arrayBuffer());
  } else {
    bytes = new Uint8Array(raw);
  }
  if (bytes.byteLength === 0) return avvis(400, 'mangler', 'bilde');
  if (bytes.byteLength > MAKS_BILDE_BYTES) return avvis(413, 'for_stor', 'bilde');
  const type = bildetype(bytes);
  if (!type) return avvis(415, 'feil_type', 'bilde');
  // Posisjonsdata og annen metadata fjernes før lagring (se bildemetadata.ts).
  let metadataFjernet = true;
  if (type === 'image/jpeg' || type === 'image/png') {
    const renset = type === 'image/jpeg' ? fjernJpegMetadata(bytes) : fjernPngMetadata(bytes);
    if (!renset) return avvis(415, 'feil_type', 'bilde');
    bytes = renset;
  } else {
    metadataFjernet = false;
  }

  const bildeId = crypto.randomUUID();
  const nokkel = `foresporsler/${id}/${bildeId}`;
  try {
    await env.BILDER.put(nokkel, bytes, { httpMetadata: { contentType: type } });
  } catch (e) {
    console.error(JSON.stringify({ hendelse: 'r2_feilet', feil: feiltekst(e) }));
    return avvis(503, 'utilgjengelig', 'bilde');
  }
  let lagret = false;
  try {
    if (!(await leggTilBildeMaks(db, id, bildeId, nokkel, MAKS_BILDER))) {
      await env.BILDER.delete(nokkel).catch(() => {});
      return avvis(409, 'for_mange', 'bilde');
    }
    lagret = true;
    if (merke) await leggTilBildeMerke(db, id, merke);
    if (!metadataFjernet) await loggHendelse(db, id, 'bilde_metadata_ikke_fjernet', { bildeId, type });
    // Sist: når tillegget er logget, er bildet ferdig mottatt.
    await loggTillegg(db, id, merke ? { hva: 'bilde', bildeId, merke } : { hva: 'bilde', bildeId });
  } catch (e) {
    console.error(JSON.stringify({ hendelse: 'bilde_feilet', feil: feiltekst(e) }));
    // Rydd opp (så godt det går), så et nytt forsøk ikke etterlater foreldreløse filer eller rader.
    if (lagret) await db.prepare('DELETE FROM bilder WHERE id = ?').bind(bildeId).run().catch(() => {});
    await env.BILDER.delete(nokkel).catch(() => {});
    return feilSvar(500, 'serverfeil');
  }
  ctx.waitUntil(etterEndring(env, id, status, deps));
  return html ? videre(`${tilbake()}&ok=1`) : json(201, { bildeId });
}

// --- Signerte bildelenker til Eirik ---

export async function haandterHentBilde(request: Request, env: Env, deps: { naa?: () => Date } = {}): Promise<Response> {
  if (!env.DB || !env.SKJEMA_HMAC || !env.BILDER) return feilSvar(503, 'ikke_konfigurert');
  const url = new URL(request.url);
  let bildeId: string;
  try {
    bildeId = decodeURIComponent(url.pathname.replace(/\/+$/, '').split('/').pop() ?? '');
  } catch {
    return feilSvar(403, 'uautorisert');
  }
  const utloper = Number(url.searchParams.get('utloper'));
  const sig = url.searchParams.get('sig') ?? '';
  const naaSek = Math.floor((deps.naa ?? (() => new Date()))().getTime() / 1000);
  if (!(await verifiserBildeLenke(bildeId, utloper, sig, env.SKJEMA_HMAC, naaSek))) return feilSvar(403, 'uautorisert');

  const nokkel = await hentBildeNokkel(env.DB, bildeId);
  const obj = nokkel ? await env.BILDER.get(nokkel) : null;
  if (!obj) return feilSvar(404, 'ikke_funnet');
  return new Response(obj.body as unknown as ReadableStream, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': 'private, no-store',
      'content-disposition': 'inline',
      'x-content-type-options': 'nosniff',
    },
  });
}
