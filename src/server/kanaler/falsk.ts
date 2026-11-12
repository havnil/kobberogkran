// Falsk kanal for tester og for drift før leverandørene er valgt (oppgave 10).
// Sender ingenting; registrerer kallene og svarer det den er satt opp til.
import type { Kanal, Kanalnavn, Mal, SendSvar } from './index';

export interface FalskKanalValg {
  /** Standard true. */
  ok?: boolean;
  feil?: string;
  /** Kast en feil i stedet for å svare (som et nettverksbrudd). */
  kast?: boolean;
}

export class FalskKanal implements Kanal {
  readonly kall: { til: string; mal: Mal }[] = [];

  constructor(
    readonly navn: Kanalnavn,
    private readonly valg: FalskKanalValg = {},
  ) {}

  async send(til: string, mal: Mal): Promise<SendSvar> {
    this.kall.push({ til, mal });
    if (this.valg.kast) throw new Error(`${this.navn}: falsk nettverksfeil`);
    const ok = this.valg.ok ?? true;
    return ok ? { ok } : { ok, feil: this.valg.feil ?? `${this.navn}: falsk feil` };
  }
}
