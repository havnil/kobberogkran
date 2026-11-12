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

## Skjemaet og bildene (oppgave 7)

Hemmelighetene `TURNSTILE_SECRET` og `SKJEMA_HMAC` må være satt. Uten dem svarer skjemaets API
503, altså stengt. Lenken i kvitteringen (`/send-bilder/?id=…&token=…`) utløper ikke. Roterer du
`SKJEMA_HMAC`, slutter alle tidligere lenker og alle bildelenker til Eirik å virke.

**Posisjonsdata i bilder. Ta dette med i personvernteksten.**

- **JPEG og PNG:** serveren fjerner Exif, XMP og IPTC før lagring. Dette er stedet der
  GPS-posisjonen ligger.
- **HEIC (iPhone):** skjemaet med JavaScript gjør HEIC om til JPEG i nettleseren før opplasting,
  så metadata fjernes også her.
- **Kjent begrensning:** et HEIC- eller WebP-bilde som lastes opp uten JavaScript (siden for å
  sende flere bilder senere), lagres **uendret**, med eventuell posisjon. Hendelsen
  `bilde_metadata_ikke_fjernet` logges for bildet.
- Bildene vises bare for Eirik via signerte lenker som utløper etter 14 dager.

## Skjemaet i nettleseren (oppgave 8)

**Turnstile-nøkkelen (site key) settes i bygget, ikke i `vars`.** Sidene med skjemaet er
forhåndsrendret, så Worker-variabelen `TURNSTILE_SITE_KEY` når dem ikke. Eieren gjør dette:

1. Opprett en Turnstile-widget i Cloudflare (Turnstile → Add widget) for `kobberogkran.no`
   (og eventuelt preview-domenet). Modus «Managed».
2. I Workers Builds (Settings → Build → Variables) legges **byggvariabelen**
   `PUBLIC_TURNSTILE_SITE_KEY=<site key>`. Den er offentlig og havner i HTML-en.
3. Hemmeligheten (`TURNSTILE_SECRET`) settes som før med `wrangler secret put`.

Uten `PUBLIC_TURNSTILE_SITE_KEY` bruker bygget Cloudflares testnøkkel
`1x00000000000000000000AA`, som alltid godkjennes. Den er bare for utvikling og det lukkede
testmiljøet, og virker bare sammen med testhemmeligheten `1x0000000000000000000000000000000AA`.
**En lanseringsbygg (`LAUNCH=true`) uten nøkkelen feiler**, så testnøkkelen kan aldri komme i
produksjon. Lokalt: `npm run dev` bruker testnøkkelen; sett `TURNSTILE_SECRET` til testhemmeligheten
i `.dev.vars` for å sende skjemaet lokalt.

**Uten JavaScript** kan Turnstile ikke kjøre, og serveren avviser skjemaet. Skjemaet er fortsatt et
vanlig `<form method="post">`, men en `<noscript>`-tekst (`tekster.skjema.utenJs`) viser telefon og
WhatsApp i stedet.

**Personvern (ta med i personvernteksten):**

- Adresseforslagene hentes fra Kartverket (`ws.geonorge.no`). Det kunden skriver i adressefeltet
  (fra 3 tegn), og posisjonen ved «Bruk der jeg er nå», sendes dit. Ingen andre data sendes.
- Turnstile (Cloudflare) er det eneste tredjepartsskriptet, og lastes bare på sider med skjemaet.
- Skjemaet lagrer ingenting i nettleseren (ingen cookies, localStorage eller sessionStorage).
- Bildene gjøres om og skaleres i nettleseren (maks 2000 px, JPEG). Det fjerner all metadata, også
  GPS-posisjonen. HEIC gjøres om til JPEG først.
