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
  /** Per region: the corners of the smallest convex shape around its places, in drawing order. */
  former: { x: number; y: number }[][];
  /** Places without coordinates (listed, not drawn). */
  utenKoordinater: string[];
}

/** Convex hull (Andrew's monotone chain), so a region's shape never folds in on itself. */
export function konveksHull<T extends { x: number; y: number }>(punkter: T[]): { x: number; y: number }[] {
  const p = [...new Map(punkter.map((q) => [`${q.x},${q.y}`, { x: q.x, y: q.y }])).values()].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const kryss = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const halv = (liste: { x: number; y: number }[]) => {
    const ut: { x: number; y: number }[] = [];
    for (const q of liste) {
      while (ut.length >= 2 && kryss(ut[ut.length - 2], ut[ut.length - 1], q) <= 0) ut.pop();
      ut.push(q);
    }
    ut.pop();
    return ut;
  };
  return [...halv(p), ...halv([...p].reverse())];
}

/**
 * Projects the places of each region onto a `bredde`-wide canvas around the base, with `marg` px around the
 * outermost places. North is up; the height follows the area's shape.
 */
export function lagKart(regioner: { steder: string[] }[], bredde = 600, marg = 70): Kart {
  const alle = regioner.flatMap((r, region) => r.steder.map((navn, i) => ({ navn, region, base: region === 0 && i === 0 })));
  const kjente = alle.filter((p) => KOORDINATER[p.navn]);
  const utenKoordinater = alle.filter((p) => !KOORDINATER[p.navn]).map((p) => p.navn);
  if (kjente.length === 0) return { bredde, hoyde: 0, skala: 0, base: null, punkter: [], former: [], utenKoordinater };

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
  const former = regioner.map((_, i) => konveksHull(punkter.filter((p) => p.region === i)));
  return { bredde, hoyde, skala, base: b ? { x: b.x, y: b.y } : null, punkter, former, utenKoordinater };
}
