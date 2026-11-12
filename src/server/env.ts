import type { D1Database, R2Bucket, SendEmail } from '@cloudflare/workers-types';

/**
 * Bindinger serveren trenger. De er ennå ikke lagt inn i wrangler.jsonc fordi
 * ressursene ikke finnes. Se docs/runbooks/nettside-eiersteg.md.
 */
export interface Env {
  DB: D1Database;
  BILDER: R2Bucket;
  EPOST: SendEmail;
  TURNSTILE_SITE_KEY: string;
  // Hemmeligheter (wrangler secret put). Valgfrie til de er satt.
  TURNSTILE_SECRET?: string;
  SKJEMA_HMAC?: string;
  ANTHROPIC_API_KEY?: string;
}
