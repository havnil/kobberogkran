import type { D1Database, R2Bucket, SendEmail } from '@cloudflare/workers-types';

/**
 * Bindinger serveren trenger. De er ennå ikke lagt inn i wrangler.jsonc fordi
 * ressursene ikke finnes. Se docs/runbooks/nettside-eiersteg.md.
 */
export interface Env {
  DB: D1Database;
  BILDER: R2Bucket;
  EPOST: SendEmail;
  // Hemmeligheter (wrangler secret put). Valgfrie til de er satt.
  TURNSTILE_SECRET?: string;
  SKJEMA_HMAC?: string;
  ANTHROPIC_API_KEY?: string;
  // Varsel til Eirik (vars i wrangler.jsonc). Uten disse logges varsel_feil og status blir 'sortert'.
  /** Eiriks e-postadresse. Må være en verifisert mottaker i Email Routing. */
  VARSEL_TIL?: string;
  /** Avsender, på et domene med Email Routing, f.eks. varsel@kobberogkran.no. */
  VARSEL_FRA?: string;
  /** Grunnadresse for lenker (se src/lib/nettsted.ts). Tom eller utelatt: https://kobberogkran.no */
  NETTSTED_URL?: string;
  // Meldingskanaler og tapte anrop (oppgave 12). Hemmeligheter; uten dem avvises webhookene.
  /** Tokenet Meta sender ved verifisering av WhatsApp-webhooken (`hub.verify_token`). */
  WHATSAPP_VERIFY_TOKEN?: string;
  /** App Secret fra Meta-appen. Signerer POST-kroppen (`X-Hub-Signature-256`). */
  WHATSAPP_APP_SECRET?: string;
  /** Delt hemmelighet med telefonitjenesten. HMAC-SHA256 av kroppen, hex, i `X-Signatur`. */
  TELEFONI_WEBHOOK_SECRET?: string;
}

/** Det route-ene trenger fra Workers' ExecutionContext (`Astro.locals.cfContext`). */
export interface Kontekst {
  waitUntil(p: Promise<unknown>): void;
}
