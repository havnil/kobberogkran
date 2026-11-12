# Eiersteg for nettsiden: sjekkliste fram til lansering

Dette er alt eieren må gjøre før nettsiden med skjema, bildeopplasting, varsel til Eirik og
tapte anrop kan lanseres. Ressurser, hemmeligheter, DNS og innstillinger i Cloudflare, Meta og
hos leverandørene er bare for eieren. Agenter rører dem aldri.

Gjør stegene i rekkefølge. Selve Cloudflare-oppsettet (repo, domener, CMS-innlogging,
overvåking) står i [cloudflare-setup.md](cloudflare-setup.md). Her er det som kommer i tillegg.

## Oversikt: variabler og hemmeligheter

| Navn | Type | Hvor settes den | Brukes til |
| --- | --- | --- | --- |
| `DB` | D1-binding | `wrangler.jsonc` (steg 4) | Database |
| `BILDER` | R2-binding | `wrangler.jsonc` | Bilder fra skjemaet |
| `EPOST` | `send_email`-binding | `wrangler.jsonc` | Varsel til Eirik |
| `PUBLIC_TURNSTILE_SITE_KEY` | Byggvariabel (offentlig) | Workers Builds → Settings → Build → Variables | Turnstile-nøkkelen i HTML-en |
| `TURNSTILE_SITE_KEY` | Variabel | `wrangler.jsonc` `vars` | Samme nøkkel, for serveren |
| `TURNSTILE_SECRET` | Hemmelighet | `npx wrangler secret put` | Sjekker Turnstile på serveren |
| `SKJEMA_HMAC` | Hemmelighet | `npx wrangler secret put` | Signerer kvitteringslenker og bildelenker |
| `ANTHROPIC_API_KEY` | Hemmelighet | `npx wrangler secret put` | AI-sammendrag til Eirik |
| `WHATSAPP_VERIFY_TOKEN` | Hemmelighet | `npx wrangler secret put` | Verifisering av WhatsApp-webhooken |
| `WHATSAPP_APP_SECRET` | Hemmelighet | `npx wrangler secret put` | Signatur fra Meta |
| `TELEFONI_WEBHOOK_SECRET` | Hemmelighet | `npx wrangler secret put` | Signatur fra telefonitjenesten |
| `VARSEL_TIL` | Variabel | `wrangler.jsonc` `vars` | Eiriks e-postadresse |
| `VARSEL_FRA` | Variabel | `wrangler.jsonc` `vars` | Avsender, f.eks. `varsel@kobberogkran.no` |
| `NETTSTED_URL` | Variabel (valgfri) | `wrangler.jsonc` `vars` | Grunnadresse i lenker. Standard `https://kobberogkran.no` |
| `LAUNCH` | Byggvariabel | Workers Builds → Settings → Build → Variables | `true` på lanseringsdagen (steg 12) |

Hemmeligheter settes slik, fra repoet på din maskin (du blir spurt om verdien):

```
npx wrangler secret put TURNSTILE_SECRET
```

Tilfeldige hemmeligheter (`SKJEMA_HMAC`, `WHATSAPP_VERIFY_TOKEN`) lager du med:

```
openssl rand -hex 32
```

Skriv aldri hemmeligheter i filer i repoet, i issues eller i chat. Roterer du `SKJEMA_HMAC`,
slutter alle tidligere kvitteringslenker og alle bildelenker til Eirik å virke.

## Sjekkliste

### 1. Opprett databasen (D1)

Ressursene må finnes før `wrangler.jsonc` endres, ellers feiler Workers Builds.

```
npx wrangler d1 create kobberogkran
```

Skriv ned `database_id` fra kommandoen.

### 2. Opprett R2-bøtta med plassering i EU

```
npx wrangler r2 bucket create kobberogkran-bilder --location weur
```

Sjekk i Cloudflare → R2 → `kobberogkran-bilder` at plasseringen er Europa (Western Europe).
Bildene av kundene og hyttene deres er personopplysninger.

### 3. Kjør migrasjonen

```
npx wrangler d1 migrations apply kobberogkran --remote
```

`migrations/0001_init.sql` kan bare endres **før** den er kjørt første gang. Etter det går alle
endringer i nye filer (`0002_…`), aldri ved å rette den gamle.

### 4. Legg bindingene inn i wrangler.jsonc (via PR)

Gjør dette først når D1, R2 og e-post (steg 7) finnes. `wrangler.jsonc` krever menneskelig
godkjenning, så endringen går via en pull request: be `@claude` eller en utvikler lage den, og
godkjenn selv. Innholdet (bytt ut `<database_id>` og adressene):

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
	{ "name": "EPOST", "destination_address": "<Eiriks e-postadresse>" }
],
"vars": {
	"TURNSTILE_SITE_KEY": "<site key fra Turnstile>",
	"VARSEL_TIL": "<Eiriks e-postadresse>",
	"VARSEL_FRA": "varsel@kobberogkran.no"
}
```

`VARSEL_FRA` må ligge på domenet med Email Routing (steg 7). `NETTSTED_URL` kan legges til i
`vars` for å overstyre grunnadressen, f.eks. i en preview.

Sjekk også at **Build command** i Workers Builds fortsatt er `npm run build`. Lanseringssjekken
(steg 12) kjører inni den kommandoen.

### 5. Opprett Turnstile

Turnstile stopper roboter i skjemaet.

1. Cloudflare → Turnstile → **Add widget** for `kobberogkran.no` (og eventuelt preview-domenet).
   Modus «Managed».
2. Legg **site key** i Workers Builds som byggvariabelen `PUBLIC_TURNSTILE_SITE_KEY`. Sidene med
   skjemaet er forhåndsrendret, så nøkkelen må være med i bygget, ikke bare i `vars`. Den er
   offentlig.
3. Legg samme nøkkel som `TURNSTILE_SITE_KEY` i `vars` (steg 4).
4. Sett hemmeligheten: `npx wrangler secret put TURNSTILE_SECRET`.

Uten `PUBLIC_TURNSTILE_SITE_KEY` bruker bygget Cloudflares testnøkkel
`1x00000000000000000000AA`, som alltid godkjennes. Den er bare for utvikling og
testmiljøet. **Et lanseringsbygg (`LAUNCH=true`) uten ekte nøkkel feiler**, så testnøkkelen kan
ikke komme i produksjon. Lokalt bruker `npm run dev` testnøkkelen; sett `TURNSTILE_SECRET` til
testhemmeligheten `1x0000000000000000000000000000000AA` i `.dev.vars` for å sende skjemaet lokalt.

### 6. Opprett de andre hemmelighetene

```
npx wrangler secret put SKJEMA_HMAC
npx wrangler secret put ANTHROPIC_API_KEY
```

- `SKJEMA_HMAC`: lag den med `openssl rand -hex 32`. Uten den (og uten `TURNSTILE_SECRET`)
  svarer skjemaets API 503, altså stengt. Den signerer også bildelenkene; uten den står det bare
  hvor mange bilder som er lagret.
- `ANTHROPIC_API_KEY`: nøkkel fra Anthropic Console. Modellen er `claude-haiku-5-5`. Uten nøkkel
  sendes varselet likevel, men bare med reglene og rådata. AI-teksten går bare til Eirik, aldri
  til kunden.
- Hemmelighetene til meldingsleverandørene (`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`,
  `TELEFONI_WEBHOOK_SECRET`) settes i steg 9 og 10.

### 7. Verifiser e-postadressen for varsel til Eirik

Nye forespørsler sorteres (faste regler pluss AI-sammendrag) og sendes til Eirik på e-post.
Bilder sendes ikke som vedlegg, men som signerte lenker som virker i 14 dager.

1. Cloudflare → `kobberogkran.no` → **Email** → **Email Routing**: slå på tjenesten.
2. Legg til Eiriks adresse som mottakeradresse (destination address) og **verifiser** den (han
   får en e-post med en lenke).
3. Kontroller at `VARSEL_TIL`, `VARSEL_FRA` og `send_email` i steg 4 stemmer.

Mangler `VARSEL_TIL` eller `VARSEL_FRA`, eller avviser e-posten meldingen, blir forespørselen
stående med status `sortert`, og hendelsen `varsel_feil` logges i tabellen `hendelser`.

### 8. Test AI-sorteringen en gang for ekte

Før lansering, med `ANTHROPIC_API_KEY` satt og alt over på plass:

1. Send en testforespørsel i skjemaet (på preview-adressen).
2. Sjekk at e-posten til Eirik har et **AI-sammendrag**, ikke bare reglene. Står det bare
   regler og rådata, er nøkkelen feil eller mangler.
3. Slett testforespørselen når du er ferdig.

### 9. Velg leverandører og skaff nytt nummer

Forslaget med priser og risiko står i
[leverandorer-meldinger](../research/2026-11-13-leverandorer-meldinger.md). Eieren velger.

1. **Test før kjøp.** Kjøp ett nummer og prøv å registrere det i WhatsApp Business-appen på
   Eiriks telefon (verifisering med SMS eller samtalekode). Vent med å publisere nummeret til
   det virker. Feiler det, trengs et mobilabonnement til WhatsApp, eller to numre.
2. Kjøp det nye nummeret og sett opp videresending til Eiriks mobil og et webhook ved ubesvart
   anrop.
3. Når leverandørene er valgt, må en utvikler legge til leverandøradapterne: kanalene
   (`Kanal`-implementasjoner for WhatsApp, RCS og SMS) og adapteren for telefoniens format og
   signatur. **Til det er gjort sendes ingen melding til kunden** (`lagKanaler` gir en tom
   liste). Eirik får likevel varsel om hvert tapte anrop.

Webhookene avviser alt til hemmelighetene er satt:

| Hemmelighet | Hva | Uten den |
| --- | --- | --- |
| `WHATSAPP_VERIFY_TOKEN` | Et tilfeldig token som du velger og skriver inn som «Verify token» i Meta-appen | Verifiseringen (GET) gir 403 |
| `WHATSAPP_APP_SECRET` | «App Secret» fra Meta-appen (App settings → Basic). Signerer `X-Hub-Signature-256` | POST gir 503 |
| `TELEFONI_WEBHOOK_SECRET` | Delt hemmelighet med telefonitjenesten. HMAC-SHA256 av kroppen, hex, i `X-Signatur` | POST gir 503 |

**Telefoni:** Telefonitjenesten skal sende `POST https://kobberogkran.no/api/telefoni/ubesvart`
med JSON `{ "fra": "+47...", "tidspunkt": "<ISO 8601, valgfritt>" }` og header
`X-Signatur: <hex av HMAC-SHA256(kropp, TELEFONI_WEBHOOK_SECRET)>`. Kan leverandøren ikke dette
formatet, lages en egen adapter. Skjult nummer gir ingen melding, bare varsel til Eirik. Samme
nummer får høyst én melding per 30 minutter (tabellen `anrop`).

### 10. Verifiser bedriften hos Meta og send inn WhatsApp-malene

1. I Meta Business Suite: verifiser bedriften (Kobber og Kran AS).
2. I Meta-appen (WhatsApp → Configuration) settes callback-URL til
   `https://kobberogkran.no/api/whatsapp/webhook` og samme verify token som i
   `WHATSAPP_VERIFY_TOKEN`. Abonner på feltet `messages`.
3. Send inn malene `kvittering` og `tapt_anrop` til godkjenning. **Meta må godkjenne dem**, og
   det kan ta tid. Teksten må stemme med `tekster.kvittering` og `tekster.taptAnrop` i CMS-et.
4. Inngående WhatsApp-meldinger sendes som varsel til Eirik og besvares aldri automatisk. Eirik
   svarer selv i WhatsApp Business-appen.

Kunden får bare faste maler (`kvittering` og `tapt_anrop`), aldri fritt AI-skrevet tekst.
Systemet prøver WhatsApp, så RCS, så SMS. I teksten for tapt anrop kan du plassere
`{skjemaLenke}` (skjemaet med `?kilde=tapt-anrop`) og `{whatsappLenke}` (wa.me med ferdig
hilsen). Står de ikke i teksten, legges lenkene til nederst, hver på egen linje.

### 11. Godkjenn teksten, personvernet og sesongkortet

**Plassholdertekster.** Alle tekster merket `PLASSHOLDER:` og alle engelske tekster med prefikset
`[EN]` er arbeidstitler. Du, eller en du stoler på, skriver eller godkjenner endelig tekst i
CMS-et (`/admin`) for:

- sidene, tjenestene, firmadata, omtaler og teksten på skjemaknappen
- CMS-hintet om `[ … ]` i WhatsApp-hilsenen
- malene til WhatsApp/Meta (steg 10) og tekstene for kvittering og tapt anrop
- teksten «Det lekker nå»
- vilkår og personvernerklæring

Bildene i `public/images/uploads/` er plassholdere til ekte bilder finnes. Se
[bildebeskrivelser.md](../bildebeskrivelser.md).

**Personvern. Bestem og skriv inn i personvernerklæringen:**

- **Hvor lenge** forespørsler, bilder og tabellen `anrop` (som inneholder telefonnumre) lagres.
  Det finnes ingen automatisk sletting, så avgjør også hvem som sletter og hvor ofte.
- Serveren fjerner Exif, XMP og IPTC (der GPS-posisjonen ligger) fra JPEG og PNG før lagring.
  HEIC fra iPhone gjøres om til JPEG i nettleseren når skjemaet har JavaScript, så metadata
  fjernes også der. **Kjent begrensning:** et HEIC- eller WebP-bilde som lastes opp uten
  JavaScript (siden for å sende flere bilder senere) lagres **uendret**, med eventuell posisjon.
  Hendelsen `bilde_metadata_ikke_fjernet` logges. Skriv dette i personvernteksten.
- Bildene vises bare for Eirik via signerte lenker som utløper etter 14 dager. Lenken i
  kvitteringen (`/send-bilder/?id=…&token=…`) utløper ikke.
- Adresseforslagene hentes fra Kartverket (`ws.geonorge.no`). Det kunden skriver i adressefeltet
  (fra 3 tegn), og posisjonen ved «Bruk der jeg er nå», sendes dit. Ingen andre data sendes.
- **AI-sortering hos Anthropic** (når `ANTHROPIC_API_KEY` er satt). For hver ny forespørsel, og
  igjen når kunden fyller ut steg 2, sendes dette til Anthropics API (modellen `claude-haiku-5-5`):
  tjenesten, kundens hast, beskrivelsen og svarene fra skjemaet (med telefonnumre og
  e-postadresser i fritekst skrubbet bort), hva bildene viser (merkene, ikke bildene), antall
  bilder, omtrentlig kjøretid fra Hemnes, om jobben er innenfor området, og resultatet av
  regelsjekken. **Sendes ikke:** navn, telefon, e-post, adressen eller gårds- og bruksnummeret i
  stedsfeltet, koordinater og bildene. Merk at kunden selv kan skrive en adresse i
  beskrivelsen; den skrubbes ikke. Hvor lenge Anthropic lagrer API-data, og om de brukes til
  trening, står i Anthropics vilkår og personvernpolicy. **Sjekk gjeldende vilkår** før lansering
  og skriv Anthropic inn som databehandler i personvernerklæringen.
- Turnstile (Cloudflare) er det eneste tredjepartsskriptet, og lastes bare på sider med skjemaet.
- Skjemaet lagrer ingenting i nettleseren (ingen cookies, localStorage eller sessionStorage).
- Uten JavaScript kan Turnstile ikke kjøre, og serveren avviser skjemaet. Da viser siden telefon
  og WhatsApp i stedet (`tekster.skjema.utenJs`).

**Sesongkortet for hytte.** Teksten på hyttekortet bytter etter måned (august–november er
«høst», resten «vår»), men bare når siden bygges på nytt. Bygg derfor om siden hver måned: en
vanlig lagring i CMS-et gjør det, eller sett opp en deploy hook i Cloudflare (Workers Builds →
Settings → Deploy Hooks) som et planlagt kall utløser.

### 12. Lanseringsdagen

Gjør dette når alt over er ferdig:

1. **Erstatt alle plassholdere** (tekst, bilder, firmadata). Sjekk hvor mange som gjenstår:
   `npm run check:launch`. Uten `LAUNCH=true` teller den bare; med `LAUNCH=true` feiler den og
   lister hvor hver plassholder ligger.
2. **Sett `LAUNCH=true`** som byggvariabel i Workers Builds (Settings → Build → Variables) og kjør
   et nytt bygg. Ligger det en plassholder igjen, feiler bygget og ingenting går live. Det er
   meningen.
3. **Sett Access-scope til «Previews only»**, slik at produksjon er åpen for alle og bare
   previews ligger bak innlogging.
4. **Legg til custom domains** og sett opp **omdirigering fra www til domenet**. Se
   [cloudflare-setup.md](cloudflare-setup.md) seksjon 2 (DNS først: [dns-migration.md](dns-migration.md)).
5. **Slå på overvåking:** `WATCHDOG_ENABLED=true` og pek Grok Bot på siden. Se
   [cloudflare-setup.md](cloudflare-setup.md) seksjon 4 og [watchdog.md](watchdog.md).
6. Send en siste testforespørsel på `https://kobberogkran.no` og kontroller varselet til Eirik.

Feiler noe etter lansering, se [rollback.md](rollback.md).
