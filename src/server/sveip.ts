// Sveip etter forespørsler der varselet til Eirik ikke har gått (status 'ny' eller 'sortert'), f.eks.
// fordi e-posten feilet eller Workeren ble stoppet midt i `waitUntil`. Kjøres av en Cron Trigger
// (`scheduled` i src/worker.ts). Koblingen i wrangler.jsonc er et eiersteg: se
// docs/runbooks/nettside-eiersteg.md, «Cron for varsel som ikke gikk».
//
// - Bare forespørsler eldre enn SVEIP_ALDER_MS: de ferske håndteres av `waitUntil` i API-et.
// - Ikke eldre enn SVEIP_MAKS_ALDER_MS: en feil som aldri går over (f.eks. VARSEL_TIL mangler), skal
//   ikke gi evige forsøk. Status blir stående, og hendelsen 'varsel_feil' viser hva som skjedde.
// - Låsen i sorterOgVarsle gjør det trygt om API-et sender samtidig. AI-en kalles ikke på nytt for
//   'sortert' (forrige sortering gjenbrukes).
// - Også varslede forespørsler med et tillegg som ikke ble sendt (e-posten feilet, eller Workeren ble
//   stoppet i samlevinduet før den rakk å sende). Uten dette ville et slikt tillegg ventet på neste
//   tillegg fra kunden, som kanskje aldri kommer.
import type { Env } from './env';
import { sorterOgVarsle, type SorterOgVarsleDeps } from './sortering/index';
import { varsleTillegg } from './tillegg';

export const SVEIP_ALDER_MS = 5 * 60 * 1000;
export const SVEIP_MAKS_ALDER_MS = 7 * 24 * 60 * 60 * 1000;
/** Maks antall per kjøring, så én kjøring holder seg godt innenfor tidsgrensen. */
export const SVEIP_MAKS_ANTALL = 10;

/** Prøver varselet på nytt for gamle forespørsler uten varsel. Returnerer antallet som ble prøvd. Kaster aldri. */
export async function sveipUvarslede(env: Env, deps: SorterOgVarsleDeps = {}): Promise<number> {
  const naa = (deps.naa ?? (() => new Date()))();
  let ider: string[];
  try {
    const gammel = new Date(naa.getTime() - SVEIP_ALDER_MS).toISOString();
    const forGammel = new Date(naa.getTime() - SVEIP_MAKS_ALDER_MS).toISOString();
    // Uvarslede forespørsler, og varslede med et tillegg som ingen varsel har dekket ennå (samme
    // `dekket` som i tillegg.ts). Et tillegg yngre enn SVEIP_ALDER_MS kan fortsatt være i et samlevindu.
    const r = await env.DB.prepare(
      `SELECT f.id FROM foresporsler f
        WHERE f.opprettet > ?
          AND ((f.status IN ('ny', 'sortert') AND f.opprettet < ?)
            OR (f.status = 'varslet' AND EXISTS (
                 SELECT 1 FROM hendelser t
                  WHERE t.foresporsel_id = f.id AND t.type = 'tillegg' AND t.opprettet < ?
                    AND t.rowid > COALESCE((
                      SELECT MAX(CAST(json_extract(h.data_json, '$.dekket') AS INTEGER)) FROM hendelser h
                       WHERE h.foresporsel_id = f.id
                         AND h.type IN ('varsel_ok', 'tillegg_varsel', 'tillegg_varsel_direkte')
                         AND json_extract(h.data_json, '$.dekket') IS NOT NULL), 0))))
        ORDER BY f.opprettet LIMIT ?`,
    )
      .bind(forGammel, gammel, gammel, SVEIP_MAKS_ANTALL)
      .all<{ id: string }>();
    ider = r.results.map((x) => x.id);
  } catch (e) {
    console.error(JSON.stringify({ hendelse: 'sveip_feilet', feil: String(e).slice(0, 300) }));
    return 0;
  }
  for (const id of ider) {
    // Begge kaster aldri.
    await sorterOgVarsle(env, id, deps);
    await varsleTillegg(env, id, { samle: false }, { varsler: deps.varsler, sorterer: deps.sorterer, naa: deps.naa });
  }
  if (ider.length) console.warn(JSON.stringify({ hendelse: 'sveip', antall: ider.length }));
  return ider.length;
}
