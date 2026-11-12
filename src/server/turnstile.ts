// Cloudflare Turnstile, verifisert på serveren. Tokenet fra widgeten er engangs og gjelder i 5 minutter.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIDSAVBRUDD_MS = 5000;

/** 'ok': godkjent. 'avvist': Cloudflare sa nei. 'feil': kunne ikke spørre Cloudflare. */
export type TurnstileSvar = 'ok' | 'avvist' | 'feil';

export async function verifiserTurnstile(
  token: string,
  hemmelighet: string,
  valg: { ip?: string | null; idempotencyKey?: string; fetch?: typeof fetch } = {},
): Promise<TurnstileSvar> {
  const hent = valg.fetch ?? fetch;
  const kropp = new URLSearchParams({ secret: hemmelighet, response: token });
  if (valg.ip) kropp.set('remoteip', valg.ip);
  // UUID vi lager selv. Et nytt forsøk med samme nøkkel regnes ikke som gjenbruk av tokenet.
  if (valg.idempotencyKey) kropp.set('idempotency_key', valg.idempotencyKey);
  try {
    const res = await hent(SITEVERIFY_URL, {
      method: 'POST',
      body: kropp,
      signal: AbortSignal.timeout(TIDSAVBRUDD_MS),
    });
    if (!res.ok) return 'feil';
    const svar = (await res.json()) as { success?: unknown };
    return svar.success === true ? 'ok' : 'avvist';
  } catch {
    return 'feil';
  }
}
