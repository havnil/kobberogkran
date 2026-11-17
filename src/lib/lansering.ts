// Is this a build meant for launch (`LAUNCH=true`)? Read through `import.meta.env`: the static pages
// are prerendered in workerd, where Node's process environment has no LAUNCH. Only `true` counts, as in the
// launch gate (scripts/check-launch.mjs).
type Env = { LAUNCH?: unknown };

/** The raw `LAUNCH` value as a string, or undefined when it is not set. */
export function launchVerdi(env: Env = import.meta.env as Env): string | undefined {
  return env.LAUNCH == null || env.LAUNCH === '' ? undefined : String(env.LAUNCH);
}

export function erLansering(env: Env = import.meta.env as Env): boolean {
  return launchVerdi(env) === 'true';
}

/**
 * Cloudflare Turnstiles testnøkler og testhemmeligheter (alltid godkjent, alltid avvist osv.):
 * `1x…AA`, `2x…AB`, `3x…FF` (site keys) og `1x000…000AA` (secrets). De skal aldri i produksjon.
 * Se https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
export function erTurnstileTestnokkel(nokkel: string): boolean {
  return /^[123]x0{20,}[A-F]{2}$/.test(nokkel.trim());
}

/** Cloudflares testnøkkel som alltid godkjennes. Brukes bare utenfor lanseringsbygg. */
export const TURNSTILE_TESTNOKKEL = '1x00000000000000000000AA';

/**
 * Site key for bygget. Et lanseringsbygg krever en ekte nøkkel (ikke tom, ikke en testnøkkel) og
 * feiler ellers. Utenfor lansering brukes testnøkkelen når ingen er satt.
 */
export function turnstileNokkelForBygg(siteKey: string, lansering: boolean): string {
  const k = siteKey.trim();
  if (lansering && !k) {
    throw new Error('PUBLIC_TURNSTILE_SITE_KEY mangler i en lanseringsbygg (LAUNCH=true). Se docs/runbooks/nettside-eiersteg.md.');
  }
  if (lansering && erTurnstileTestnokkel(k)) {
    throw new Error('PUBLIC_TURNSTILE_SITE_KEY er en testnøkkel fra Cloudflare i en lanseringsbygg (LAUNCH=true). Se docs/runbooks/nettside-eiersteg.md.');
  }
  return k || TURNSTILE_TESTNOKKEL;
}
