// Egen Worker-inngang med `scheduled` for Cron Trigger. Ikke i bruk før wrangler.jsonc peker hit
// (`"main": "./src/worker.ts"`) og har `triggers.crons`; se docs/runbooks/nettside-eiersteg.md,
// «Cron for varsel som ikke gikk». Til da bruker Workeren adapterens standardinngang
// (`@astrojs/cloudflare/entrypoints/server`), som bare har `fetch`.
//
// `fetch` er adapterens egen handler (samme som standardinngangen), så sidene og API-et virker likt.
// `scheduled` prøver varselet til Eirik på nytt for forespørsler som ble stående uten varsel.
import { handle } from '@astrojs/cloudflare/handler';
import type { Env } from './server/env';
import { sveipUvarslede } from './server/sveip';

interface Planlagt {
  waitUntil(p: Promise<unknown>): void;
}

export default {
  fetch: handle,
  scheduled(_kontroll: unknown, env: Env, ctx: Planlagt): void {
    ctx.waitUntil(sveipUvarslede(env));
  },
};
