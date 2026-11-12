# Eiersteg for nettsiden

## wrangler.jsonc-tillegg (etter at ressursene finnes)

Ressursene må opprettes først, ellers feiler Workers Builds:

```
npx wrangler d1 create kobberogkran
npx wrangler r2 bucket create kobberogkran-bilder
npx wrangler d1 migrations apply kobberogkran --remote
```

Legg så dette inn i `wrangler.jsonc` (bytt ut `<database_id>` med id-en fra `d1 create`).
Endringen krever menneskelig godkjenning. Hemmeligheter (`TURNSTILE_SECRET`,
`SKJEMA_HMAC`, `ANTHROPIC_API_KEY`) settes med `wrangler secret put`, aldri i filen.

```jsonc
"d1_databases": [
	{
		"binding": "DB",
		"database_name": "kobberogkran",
		"database_id": "<database_id>",
		"migrations_dir": "migrations"
	}
],
"r2_buckets": [
	{ "binding": "BILDER", "bucket_name": "kobberogkran-bilder" }
],
"send_email": [
	{ "name": "EPOST" }
],
"vars": {
	"TURNSTILE_SITE_KEY": "<site key fra Turnstile>"
}
```

## Varsel til Eirik (oppgave 11)

Nye forespørsler sorteres (faste regler pluss et AI-sammendrag) og sendes til Eirik på e-post
via `send_email`-bindingen `EPOST`. AI-teksten går bare til Eirik, aldri til kunden. Bilder
sendes ikke som vedlegg, men som signerte lenker som virker i 14 dager.

Dette gjør eieren (DNS, e-post og Cloudflare-innstillinger er bare for eieren):

1. Slå på **Email Routing** for `kobberogkran.no` i Cloudflare, og legg til og **verifiser**
   Eiriks adresse som mottakeradresse (destination address).
2. Begrens bindingen til Eiriks adresse i `wrangler.jsonc` (krever menneskelig godkjenning):

   ```jsonc
   "send_email": [
   	{ "name": "EPOST", "destination_address": "<Eiriks e-postadresse>" }
   ],
   "vars": {
   	"TURNSTILE_SITE_KEY": "<site key fra Turnstile>",
   	"VARSEL_TIL": "<Eiriks e-postadresse>",
   	"VARSEL_FRA": "varsel@kobberogkran.no"
   }
   ```

   `VARSEL_FRA` må ligge på domenet med Email Routing. `NETTSTED_URL` (valgfri) overstyrer
   grunnadressen i bildelenkene, f.eks. for en preview. Standard er `https://kobberogkran.no`.
3. Sett hemmelighetene:
   - `npx wrangler secret put ANTHROPIC_API_KEY`: nøkkel fra Anthropic Console. Modellen er
     `claude-haiku-5-5`. Uten nøkkel sendes varselet likevel, med bare reglene og rådata.
   - `SKJEMA_HMAC` (allerede nevnt over) signerer også bildelenkene. Uten den står det bare
     hvor mange bilder som er lagret.

Mangler `VARSEL_TIL` eller `VARSEL_FRA`, eller avviser e-posten meldingen, blir forespørselen
stående med status `sortert`, og hendelsen `varsel_feil` logges i tabellen `hendelser`.
