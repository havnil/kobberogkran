/**
 * The area map: places drawn at their real position (approximate centre of the village), with distance
 * rings around the base. Distances are straight-line («luftlinje»), not driving time, so the map never
 * promises a time it can't keep. A place without coordinates here is listed but not drawn.
 */

/** Latitude and longitude (WGS84), rounded to about 100 m. */
export const KOORDINATER: Readonly<Record<string, readonly [number, number]>> = {
  Hemnes: [59.702, 11.474],
  Bjørkelangen: [59.887, 11.567],
  Aurskog: [59.925, 11.448],
  Løken: [59.798, 11.485],
  Setskog: [59.903, 11.733],
  Rømskog: [59.729, 11.826],
  Trøgstad: [59.641, 11.315],
  Askim: [59.583, 11.163],
  Mysen: [59.553, 11.326],
  Lillestrøm: [59.956, 11.05],
};

const KM_PER_GRAD_BREDDE = 111.2;

/** Straight-line distance in km (equirectangular; accurate to well under 1 % at this scale). */
export function avstandKm(a: readonly [number, number], b: readonly [number, number]): number {
  const midt = ((a[0] + b[0]) / 2) * (Math.PI / 180);
  const dy = (a[0] - b[0]) * KM_PER_GRAD_BREDDE;
  const dx = (a[1] - b[1]) * KM_PER_GRAD_BREDDE * Math.cos(midt);
  return Math.hypot(dx, dy);
}

export interface Kartpunkt {
  navn: string;
  region: number;
  x: number;
  y: number;
  base: boolean;
  km: number;
}

export interface Kart {
  bredde: number;
  hoyde: number;
  /** Pixels per km, for the rings. */
  skala: number;
  base: { x: number; y: number } | null;
  punkter: Kartpunkt[];
  /** Places without coordinates (listed, not drawn). */
  utenKoordinater: string[];
}

/**
 * Projects the places of each region onto a `bredde`-wide canvas around the base, with `marg` px around the
 * outermost places. North is up; the height follows the area's shape.
 */
export function lagKart(regioner: { steder: string[] }[], bredde = 600, marg = 70): Kart {
  const alle = regioner.flatMap((r, region) => r.steder.map((navn, i) => ({ navn, region, base: region === 0 && i === 0 })));
  const kjente = alle.filter((p) => KOORDINATER[p.navn]);
  const utenKoordinater = alle.filter((p) => !KOORDINATER[p.navn]).map((p) => p.navn);
  if (kjente.length === 0) return { bredde, hoyde: 0, skala: 0, base: null, punkter: [], utenKoordinater };

  const lat0 = (kjente.reduce((s, p) => s + KOORDINATER[p.navn][0], 0) / kjente.length) * (Math.PI / 180);
  const km = (navn: string) => {
    const [lat, lon] = KOORDINATER[navn];
    return { x: lon * KM_PER_GRAD_BREDDE * Math.cos(lat0), y: -lat * KM_PER_GRAD_BREDDE };
  };
  const rå = kjente.map((p) => ({ ...p, ...km(p.navn) }));
  const minX = Math.min(...rå.map((p) => p.x));
  const maxX = Math.max(...rå.map((p) => p.x));
  const minY = Math.min(...rå.map((p) => p.y));
  const maxY = Math.max(...rå.map((p) => p.y));
  const skala = (bredde - 2 * marg) / Math.max(maxX - minX, 1);
  const hoyde = Math.round((maxY - minY) * skala + 2 * marg);
  const baseP = rå.find((p) => p.base) ?? null;
  const basePos = baseP ? KOORDINATER[baseP.navn] : null;
  const punkter = rå.map((p) => ({
    navn: p.navn,
    region: p.region,
    base: p.base,
    x: Math.round((p.x - minX) * skala + marg),
    y: Math.round((p.y - minY) * skala + marg),
    km: basePos ? Math.round(avstandKm(basePos, KOORDINATER[p.navn])) : 0,
  }));
  const b = punkter.find((p) => p.base);
  return { bredde, hoyde, skala, base: b ? { x: b.x, y: b.y } : null, punkter, utenKoordinater };
}
