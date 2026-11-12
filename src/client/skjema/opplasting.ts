// Bildeopplasting i bakgrunnen etter steg 1 (spesifikasjonen: «Innsendingen venter aldri på dem»).
//
// - En kø med høyst 2 samtidige opplastinger.
// - Hvert bilde klargjøres først (`forbered`: HEIC → JPEG, maks 2000 px, uten metadata). Feiler det,
//   sendes originalen; serveren fjerner metadata i JPEG og PNG.
// - Nettverksfeil, 408, 429 og 5xx gir opptil 3 nye forsøk med økende ventetid. Andre svar (413, 415,
//   409 osv.) prøves ikke på nytt.
// - Er nettleseren frakoblet (`navigator.onLine`), venter jobben på `online` uten å bruke opp forsøkene.
// - Ingenting lagres i nettleseren. Bildet sendes som rå kropp med `Content-Type` (se src/server/skjema.ts).
import { forbered as standardForbered } from './bilde';

export type JobbStatus = 'venter' | 'forbereder' | 'laster' | 'frakoblet' | 'ok' | 'feilet';

export interface Jobb {
  nr: number;
  fil: File;
  merke?: string;
  status: JobbStatus;
  /** Feilkoden fra API-et, eller `nettverk`. */
  feil?: string;
}

export interface OpplasterValg {
  id: string;
  token: string;
  locale: string;
  onStatus?: (jobb: Jobb) => void;
  maksSamtidig?: number;
  /** Nye forsøk etter det første. */
  forsok?: number;
  fetch?: typeof fetch;
  forbered?: (fil: File) => Promise<Blob>;
  vent?: (ms: number) => Promise<void>;
  online?: () => boolean;
  ventPaaNett?: () => Promise<void>;
}

const PROV_IGJEN = new Set([408, 429, 500, 502, 503, 504]);
/** Ventetid før forsøk nr. n (1, 2, 3): 1 s, 3 s, 9 s. */
export const ventetid = (n: number) => 1000 * 3 ** (n - 1);

const standardVent = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const standardOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);
const standardVentPaaNett = () => new Promise<void>((r) => window.addEventListener('online', () => r(), { once: true }));

export class Opplaster {
  private readonly v: Required<Omit<OpplasterValg, 'onStatus'>> & Pick<OpplasterValg, 'onStatus'>;
  private readonly ko: Jobb[] = [];
  private aktive = 0;
  private nr = 0;
  private readonly lopende = new Set<Promise<void>>();

  constructor(valg: OpplasterValg) {
    this.v = {
      maksSamtidig: 2,
      forsok: 3,
      fetch: (...a) => fetch(...a),
      forbered: standardForbered,
      vent: standardVent,
      online: standardOnline,
      ventPaaNett: standardVentPaaNett,
      ...valg,
    };
  }

  /** Legger bildet i køen og returnerer jobben (status oppdateres underveis). */
  leggTil(fil: File, merke?: string): Jobb {
    const jobb: Jobb = { nr: ++this.nr, fil, merke, status: 'venter' };
    this.ko.push(jobb);
    this.melde(jobb);
    this.start();
    return jobb;
  }

  /** Løses når køen er tom og ingen opplasting pågår (for tester). */
  async ferdig(): Promise<void> {
    while (this.lopende.size > 0) await Promise.all([...this.lopende]);
  }

  private melde(jobb: Jobb, status?: JobbStatus) {
    if (status) jobb.status = status;
    this.v.onStatus?.(jobb);
  }

  private start() {
    while (this.aktive < this.v.maksSamtidig && this.ko.length > 0) {
      const jobb = this.ko.shift()!;
      this.aktive++;
      const p: Promise<void> = this.kjor(jobb).finally(() => {
        this.aktive--;
        this.lopende.delete(p);
        this.start();
      });
      this.lopende.add(p);
    }
  }

  private url(merke?: string): string {
    const p = new URLSearchParams({ id: this.v.id, token: this.v.token, locale: this.v.locale });
    if (merke) p.set('merke', merke);
    return `/api/bilde?${p}`;
  }

  private async kjor(jobb: Jobb): Promise<void> {
    this.melde(jobb, 'forbereder');
    let kropp: Blob;
    try {
      kropp = await this.v.forbered(jobb.fil);
    } catch {
      kropp = jobb.fil;
    }

    let forsok = 0;
    for (;;) {
      if (!this.v.online()) {
        this.melde(jobb, 'frakoblet');
        await this.v.ventPaaNett();
        continue;
      }
      this.melde(jobb, 'laster');
      let svar: Response | null = null;
      try {
        svar = await this.v.fetch(this.url(jobb.merke), {
          method: 'POST',
          body: kropp,
          headers: { 'content-type': kropp.type || 'application/octet-stream', accept: 'application/json' },
        });
      } catch {
        svar = null;
      }
      if (svar?.ok) {
        jobb.feil = undefined;
        this.melde(jobb, 'ok');
        return;
      }
      if (svar && !PROV_IGJEN.has(svar.status)) {
        jobb.feil = await svar
          .json()
          .then((j: { feil?: string }) => j?.feil ?? 'serverfeil')
          .catch(() => 'serverfeil');
        this.melde(jobb, 'feilet');
        return;
      }
      jobb.feil = svar ? 'serverfeil' : 'nettverk';
      if (forsok >= this.v.forsok) {
        this.melde(jobb, 'feilet');
        return;
      }
      forsok++;
      await this.v.vent(ventetid(forsok));
    }
  }
}
