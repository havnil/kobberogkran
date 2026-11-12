// Which testimonials may be shown. Pure functions so tests can import them without Astro.
import type { Omtale } from './innhold';

/**
 * Examples (`ekte: false`) may render with an «Eksempel» badge, except in a build meant for launch:
 * `import.meta.env.PROD` and `LAUNCH` set. Real entries (`ekte: true`) always render.
 * `LAUNCH` is read at build time with `launchVerdi()` (src/lib/lansering.ts), the same variable the
 * launch gate (`scripts/check-launch.mjs`) uses. Only `LAUNCH=true` counts, as in the gate.
 */
export function visEksempler(prod: boolean, launch: string | undefined): boolean {
  return !(prod && launch === 'true');
}

export function synligeOmtale(alle: Omtale[], eksempler: boolean): Omtale[] {
  return alle.filter((o) => o.ekte || eksempler);
}

/** All entries of the `omtale` collection (Astro only). */
export async function getOmtale(): Promise<Omtale[]> {
  const { getCollection } = await import('astro:content');
  return (await getCollection('omtale')).map((e) => e.data);
}
