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

## Meldingskanaler og tapte anrop (oppgave 12)

Kunden får bare faste maler: `kvittering` og `tapt_anrop`. Teksten redigeres i CMS-et
(`tekster.kvittering` og `tekster.taptAnrop`). Systemet prøver WhatsApp, så RCS, så SMS. Ingen
ekte kanal er koblet til ennå: de kommer når leverandørene er valgt (oppgave 10). Til da sendes
ingen melding til kunden, men Eirik får fortsatt varsel om hvert tapte anrop.

I teksten for tapt anrop kan eieren plassere `{skjemaLenke}` (skjemaet med `?kilde=tapt-anrop`)
og `{whatsappLenke}` (wa.me med ferdig hilsen). Står de ikke i teksten, legges lenkene til
nederst, hver på egen linje.

Webhookene avviser alt til hemmelighetene er satt (`wrangler secret put <NAVN>`):

| Hemmelighet | Hva | Uten den |
| --- | --- | --- |
| `WHATSAPP_VERIFY_TOKEN` | Et tilfeldig token som eieren velger og skriver inn som «Verify token» i Meta-appen | Verifiseringen (GET) gir 403 |
| `WHATSAPP_APP_SECRET` | «App Secret» fra Meta-appen (App settings → Basic). Signerer `X-Hub-Signature-256` | POST gir 503 |
| `TELEFONI_WEBHOOK_SECRET` | Delt hemmelighet med telefonitjenesten. HMAC-SHA256 av kroppen, hex, i `X-Signatur` | POST gir 503 |

Dette gjør eieren:

1. **WhatsApp:** I Meta-appen (WhatsApp → Configuration) settes callback-URL til
   `https://kobberogkran.no/api/whatsapp/webhook` og samme verify token som i
   `WHATSAPP_VERIFY_TOKEN`. Abonner på feltet `messages`. Inngående meldinger sendes som varsel til
   Eirik og besvares aldri automatisk; Eirik svarer selv i WhatsApp Business-appen.
2. **Telefoni:** Telefonitjenesten skal sende `POST https://kobberogkran.no/api/telefoni/ubesvart`
   med JSON `{ "fra": "+47...", "tidspunkt": "<ISO 8601, valgfritt>" }` og header
   `X-Signatur: <hex av HMAC-SHA256(kropp, TELEFONI_WEBHOOK_SECRET)>`. Kan leverandøren ikke dette
   formatet, lages en egen adapter når leverandøren er valgt. Skjult nummer gir ingen melding, bare
   varsel til Eirik. Samme nummer får høyst én melding per 30 minutter (tabellen `anrop`).
3. Varselet til Eirik bruker samme oppsett som over (`VARSEL_TIL`, `VARSEL_FRA`, `EPOST`).
   `NETTSTED_URL` styrer også adressen i skjemalenken.
