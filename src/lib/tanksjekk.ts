// The tank-age check («Tanksjekk»). Pure functions so tests can import them; the page runs them in the
// browser only. Nothing is stored or sent.

export type TankStatus = 'ok' | 'snart' | 'naa';

export interface TankGrenser {
  /** From this age: plan a replacement. */
  snartAr: number;
  /** From this age: replace now (the age insurers tend to treat as old). */
  grenseAr: number;
}

/** The oldest year we accept: older entries are almost certainly typos. */
export const ELDSTE_AR = 1950;

export type TankVurdering = { status: 'ugyldig' } | { status: TankStatus; alder: number };

/** Reads a year typed by the customer. Only four digits count; anything else is `null`. */
export function lesAr(tekst: string): number | null {
  const rent = tekst.trim();
  return /^\d{4}$/.test(rent) ? Number(rent) : null;
}

export function vurderTank(ar: number | null, iAr: number, grenser: TankGrenser): TankVurdering {
  if (ar === null || !Number.isInteger(ar) || ar < ELDSTE_AR || ar > iAr) return { status: 'ugyldig' };
  const alder = iAr - ar;
  const status: TankStatus = alder >= grenser.grenseAr ? 'naa' : alder >= grenser.snartAr ? 'snart' : 'ok';
  return { status, alder };
}

/** Share of the gauge to fill, 0 to 1, for an age on a scale from 0 to `maksAr`. */
export function maalerAndel(alder: number, maksAr: number): number {
  if (maksAr <= 0) return 0;
  return Math.min(Math.max(alder / maksAr, 0), 1);
}
