// Varsel til Eirik. Kanalen er e-post via Cloudflare `send_email`-bindingen (EPOST).
// Meldingen bygges som enkel MIME (ren tekst, UTF-8) uten ny avhengighet. Ingen vedlegg:
// bilder når Eirik som signerte, tidsbegrensede lenker (se bildelenke.ts).
import type { EmailMessage, SendEmail } from '@cloudflare/workers-types';
import type { Env } from './env';

export interface Varsler {
  send(til: string, emne: string, tekst: string): Promise<void>;
}

const koder = new TextEncoder();

function base64(bytes: Uint8Array): string {
  let binar = '';
  for (const b of bytes) binar += String.fromCharCode(b);
  return btoa(binar);
}

/** Fjerner linjeskift og andre kontrolltegn fra en header-verdi (hindrer header-injeksjon). */
const rensHeader = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();

/**
 * Emnet som RFC 2047 (`=?UTF-8?B?...?=`) når det inneholder annet enn skrivbar ASCII.
 * Hvert kodet ord er maks 75 tegn, og tegn deles aldri midt i en UTF-8-sekvens.
 */
export function kodEmne(emne: string): string {
  const ren = rensHeader(emne);
  if (/^[\x20-\x7e]*$/.test(ren)) return ren;
  const MAKS_BYTES = 45; // 45 byte → 60 base64-tegn + 12 tegn innpakning = 72 ≤ 75
  const biter: number[][] = [];
  let bit: number[] = [];
  for (const tegn of ren) {
    const b = koder.encode(tegn);
    if (bit.length + b.length > MAKS_BYTES) {
      biter.push(bit);
      bit = [];
    }
    bit.push(...b);
  }
  if (bit.length) biter.push(bit);
  return biter.map((b) => `=?UTF-8?B?${base64(Uint8Array.from(b))}?=`).join('\r\n ');
}

export interface MimeInput {
  fra: string;
  til: string;
  emne: string;
  tekst: string;
  dato: Date;
  /** Med vinkelparenteser, f.eks. `<uuid@kobberogkran.no>`. */
  meldingsId: string;
}

/** Rå MIME-melding med CRLF-linjeskift, ren tekst i UTF-8 og base64-kropp. */
export function lagMime(m: MimeInput): string {
  const kropp = base64(koder.encode(m.tekst.replace(/\r?\n/g, '\r\n')));
  const linjer = kropp.match(/.{1,76}/g) ?? [];
  return [
    `From: ${rensHeader(m.fra)}`,
    `To: ${rensHeader(m.til)}`,
    `Subject: ${kodEmne(m.emne)}`,
    `Date: ${m.dato.toUTCString()}`,
    `Message-ID: ${rensHeader(m.meldingsId)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    ...linjer,
    '',
  ].join('\r\n');
}

export type LagMelding = (fra: string, til: string, raw: string) => EmailMessage | Promise<EmailMessage>;

/** Standard: `EmailMessage` fra `cloudflare:email` (finnes bare i Workers, derfor dynamisk import). */
const lagEmailMessage: LagMelding = async (fra, til, raw) => {
  const { EmailMessage } = await import('cloudflare:email');
  return new EmailMessage(fra, til, raw);
};

export class EpostVarsler implements Varsler {
  constructor(
    private readonly binding: SendEmail,
    private readonly fra: string,
    private readonly lagMelding: LagMelding = lagEmailMessage,
    private readonly naa: () => Date = () => new Date(),
  ) {}

  async send(til: string, emne: string, tekst: string): Promise<void> {
    const domene = this.fra.split('@')[1] ?? 'kobberogkran.no';
    const raw = lagMime({
      fra: this.fra,
      til,
      emne,
      tekst,
      dato: this.naa(),
      meldingsId: `<${crypto.randomUUID()}@${domene}>`,
    });
    await this.binding.send(await this.lagMelding(this.fra, til, raw));
  }
}

/**
 * Sender et internt varsel til Eirik (VARSEL_TIL) og kaster aldri. Uten `varsler` brukes
 * e-post via EPOST/VARSEL_FRA. Returnerer false når varselet ikke kunne sendes (det logges, uten
 * innholdet, siden det kan inneholde personopplysninger).
 */
export async function varsleEirik(
  env: Pick<Env, 'EPOST' | 'VARSEL_TIL' | 'VARSEL_FRA'>,
  varsler: Varsler | undefined,
  emne: string,
  tekst: string,
  hendelse: string,
): Promise<boolean> {
  try {
    const til = env.VARSEL_TIL;
    const v = varsler ?? (env.VARSEL_FRA && env.EPOST ? new EpostVarsler(env.EPOST, env.VARSEL_FRA) : null);
    if (!til || !v) throw new Error('VARSEL_TIL eller VARSEL_FRA er ikke satt');
    await v.send(til, emne, tekst);
    return true;
  } catch (e) {
    const feil = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error(JSON.stringify({ hendelse: `${hendelse}_varsel_feil`, feil }));
    return false;
  }
}
