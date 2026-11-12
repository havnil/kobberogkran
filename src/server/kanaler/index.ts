// Meldingskanaler til kunden: WhatsApp først, så RCS, så SMS (spesifikasjonen, «Meldingskanaler»).
//
// - Kunden får bare faste, godkjente maler (`Mal`). Teksten kommer fra `tekster.kvittering` og
//   `tekster.taptAnrop` i src/content/tekster/<locale>.json, som eieren redigerer i CMS-et.
//   Ingen kode her lager fritekst til kunden, og AI-tekst sendes aldri hit.
// - En kanal får malen (id og variabler), ikke ferdig tekst: WhatsApp sender en godkjent mal hos Meta
//   med variablene som parametere, mens RCS og SMS bruker `tekstForMal`.
// - Ekte kanaler (WhatsApp Cloud API, RCS, SMS) kommer når eieren har valgt leverandør (oppgave 10).
//   Til da gir `lagKanaler` ingen kanaler, og `sendMedReserve` returnerer `kanal: null` og logger det.
import type { D1Database } from '@cloudflare/workers-types';
import nbJson from '../../content/tekster/nb.json';
import enJson from '../../content/tekster/en.json';
import { tekstSchema, type Tekster } from '../../lib/innhold';
import { loggHendelse } from '../db';
import type { Env } from '../env';

export type Kanalnavn = 'whatsapp' | 'rcs' | 'sms';
export type MalId = 'kvittering' | 'tapt_anrop';
export type Locale = 'nb' | 'en';

export interface Mal {
  id: MalId;
  variabler: Record<string, string>;
}

export interface SendSvar {
  ok: boolean;
  feil?: string;
}

export interface Kanal {
  navn: Kanalnavn;
  /** `tilE164` er normalisert (+47...). Skal svare `ok: false` (eller kaste) når meldingen ikke gikk. */
  send(tilE164: string, mal: Mal): Promise<SendSvar>;
}

export interface Forsok {
  kanal: Kanalnavn;
  ok: boolean;
  feil?: string;
}

export interface SendResultat {
  /** Kanalen som lyktes, eller null når ingen gjorde det. */
  kanal: Kanalnavn | null;
  forsok: Forsok[];
}

/** Logger en hendelse. Får aldri telefonnummeret, bare malen og forsøkene. */
export type Logg = (type: 'melding_feilet' | 'melding_ingen_kanal', data: { mal: MalId; forsok: Forsok[] }) => unknown;

/** Fast rekkefølge fra spesifikasjonen. */
export const REKKEFOLGE: readonly Kanalnavn[] = ['whatsapp', 'rcs', 'sms'];

const feiltekst = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

/** Standard logg: Workers-loggen, uten personopplysninger. */
const konsollLogg: Logg = (type, data) => console.warn(JSON.stringify({ hendelse: type, ...data }));

/** Logger til `hendelser` for en forespørsel (f.eks. kvitteringen, som har en forespørsel). */
export function hendelseLogger(db: D1Database, foresporselId: string): Logg {
  return (type, data) => loggHendelse(db, foresporselId, type, data);
}

/**
 * Prøver kanalene i fast rekkefølge (WhatsApp → RCS → SMS) til én lykkes. En kanal som kaster,
 * regnes som feilet. Når ingen lykkes, logges en hendelse. Kaster aldri.
 */
export async function sendMedReserve(
  kanaler: Kanal[],
  til: string,
  mal: Mal,
  deps: { logg?: Logg } = {},
): Promise<SendResultat> {
  const logg = deps.logg ?? konsollLogg;
  const sortert = [...kanaler].sort((a, b) => REKKEFOLGE.indexOf(a.navn) - REKKEFOLGE.indexOf(b.navn));
  const forsok: Forsok[] = [];
  for (const kanal of sortert) {
    let svar: SendSvar;
    try {
      svar = await kanal.send(til, mal);
    } catch (e) {
      svar = { ok: false, feil: feiltekst(e) };
    }
    forsok.push(svar.ok ? { kanal: kanal.navn, ok: true } : { kanal: kanal.navn, ok: false, feil: svar.feil });
    if (svar.ok) return { kanal: kanal.navn, forsok };
  }
  try {
    await logg(forsok.length ? 'melding_feilet' : 'melding_ingen_kanal', { mal: mal.id, forsok });
  } catch (e) {
    console.error(JSON.stringify({ hendelse: 'logg_feilet', feil: feiltekst(e) }));
  }
  return { kanal: null, forsok };
}

/**
 * Kanalene som er satt opp. Ingen ennå: leverandørene velges av eieren (oppgave 10), og de ekte
 * kanalene legges til her bak `Kanal`-grensesnittet.
 */
export function lagKanaler(_env: Env): Kanal[] {
  return [];
}

// --- Maltekst (for RCS og SMS, og for forhåndsvisning) ---

const tekstCache: Partial<Record<Locale, Tekster>> = {};
function tekster(locale: Locale): Tekster {
  return (tekstCache[locale] ??= tekstSchema.parse(locale === 'en' ? enJson : nbJson));
}

const MALFELT: Record<MalId, 'kvittering' | 'taptAnrop'> = { kvittering: 'kvittering', tapt_anrop: 'taptAnrop' };

/**
 * Variabler som alltid skal med i meldingen. Står ikke plassholderen i teksten fra CMS-et, legges
 * verdien (en lenke) til på egen linje, så meldingen ved tapt anrop alltid har begge lenkene.
 */
const PAAKREVDE: Record<MalId, string[]> = { kvittering: [], tapt_anrop: ['skjemaLenke', 'whatsappLenke'] };

/** Erstatter `{navn}` med verdien. Ukjente plassholdere står urørt. */
export function fyllMal(mal: string, variabler: Record<string, string>): string {
  return mal.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (hele, navn: string) =>
    Object.hasOwn(variabler, navn) ? variabler[navn] : hele,
  );
}

/** Den godkjente teksten for malen, med variablene fylt inn. */
export function tekstForMal(mal: Mal, locale: Locale = 'nb'): string {
  const grunn = tekster(locale)[MALFELT[mal.id]];
  const mangler = PAAKREVDE[mal.id].filter((navn) => !grunn.includes(`{${navn}}`) && mal.variabler[navn]);
  return [fyllMal(grunn, mal.variabler).trim(), ...mangler.map((navn) => mal.variabler[navn])].join('\n');
}
