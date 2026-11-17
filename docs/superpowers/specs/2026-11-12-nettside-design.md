# Kobber og Kran: design for nettsiden (fase 2)

Dato: 2026-11-12
Status: utkast til godkjenning
Bygger på: [grunnmur-designet](2026-11-11-website-foundation-design.md), [analysen av kimkran.no](../../research/2026-11-12-kimkran-analyse.md), og to simulerte vurderinger: en fra en [rørlegger](../../research/2026-11-12-tilbakemelding-rorlegger.md) og en fra en [growth-rådgiver](../../research/2026-11-12-tilbakemelding-growth.md).

## Hensikt

Kobber og Kran AS er en ny enmanns rørleggerbedrift på Hemnes i Aurskog-Høland. Eier og rørlegger er Eirik. Han har akkurat startet og har ikke drevet firma før. Planlagt oppstart er mars eller april 2027. Posisjonen er «bygdas egen rørlegger»: lokal, svarer, kommer når det er avtalt, og gir pris før han starter.

Det langsiktige målet er å gjøre det så enkelt som mulig for Eirik å drive firmaet ved å bruke AI fullt ut: til salg, kundeoppfølging og til å holde seg oppdatert. Det skjer i to prosjekter:

1. **Nettsiden (dette dokumentet).** Den skal skaffe de første kundene og ta imot forespørsler ferdig sortert. I tillegg fanger den opp tapte anrop og tilbyr WhatsApp-chat.
2. **AI-kontoret (senere, eget design).** Tilbud, ordre og faktura, purring, anmeldelses-SMS etter jobb, servicepåminnelser, Google-profilen og en assistent som kjenner forretningsplanen.

Nettsiden bygges slik at AI-kontoret kan bygge videre på de samme dataene.

## Mål

- Etter ett minutt på mobil vet kunden hvem som kommer, hva det koster og hvordan man bestiller, og har enten ringt eller sendt forespørsel.
- Det er lett å finne fram. Det var det eieren savnet på kimkran.no.
- Forespørsler kommer inn ferdig sortert, med det Eirik trenger for å vurdere jobben.
- Et tapt anrop blir ikke en tapt kunde.
- Siden er klar til lansering så snart ekte innhold er på plass, og kan ikke lanseres før det.

## Ikke-mål (nå)

- AI-kontoret: tilbud, faktura, purring, anmeldelses-SMS, påminnelser og Google-profilen.
- Døgnvakt, varmepumper, spredt avløp og sider for byggmestre. Dette er tjenester for senere.
- Kalkulator, kranspill og andre «moro»-elementer fra kimkran.no.
- Booking av tidspunkt på nettet.

## Anti-mål (feil selv om det «virker»)

- Siden lover noe Eirik ikke kan holde: tid, døgnvakt, godkjenninger han ikke har, eller en badpris.
- Oppdiktede anmeldelser, referanser eller tall blir publisert.
- AI-en skriver fritt til en kunde.
- Kunden tror en timejobb er fastpris.
- Sporing uten samtykke.
- Siden er like vanskelig å finne fram på som kimkran.no.
- Et skjema som mister kunden fordi bildeopplastingen henger på dårlig dekning.

## Beslutninger fra eieren

1. **Oppsett og flyt som kimkran.no**, men lettere å finne fram på. Designet ellers jobber vi med underveis.
2. **Skjemaet** har bilde, adresse og hva det gjelder.
   - Kunden får en fast, godkjent kvittering som **ikke lover tid**.
   - AI-en sorterer forespørselen, og sammendraget går **bare til Eirik**. AI skriver aldri fritt til kunden.
3. **Plassholdere** brukes for alt ekte innhold: telefon, godkjenninger, jobber, referanser og anmeldelser.
   - Plassholderne merkes tydelig, og lansering blokkeres så lenge de finnes.
   - Bildene er realistiske eksempler som eieren lager i Grok Imagine ut fra beskrivelser vi skriver. De merkes som plassholdere.
4. **Melding ved tapt anrop** er med i dette prosjektet, via WhatsApp, RCS og SMS som reserve. Nettsiden får WhatsApp-chat. Eirik får et nytt nummer.
5. **Den engelske versjonen speiler hele siden.** Tekstene skrives eller godkjennes av et menneske.
6. **Siden er ikke live** før eieren sier fra. Til da er test-adressen stengt bak Cloudflare Access, og domenet er ikke koblet på.

## Sidestruktur

Hver side finnes på både nb og en. Engelske adresser speiler de norske.

```
/                          Forside
/tjenester/                Oversikt
  /service-og-reparasjon/  drypper, lekker, tett vask/do, kraner, toalett
  /varmtvannstank/         bytte av varmtvannsbereder, fastpris på arbeid
  /bronn-og-vann/          pumpe, trykktank, brunt vann/lukt, filter, UV
  /hytte/                  vann på/av, vinterstengning, frosne rør
  /bad/                    rørleggerdelen, med faste partnere. Ingen pris
/priser/                   timepris, servicebil, regneeksempel, fastpris på varmtvannstank
/omrader/                  ett avsnitt med stedene vi dekker
/om/                       Om Eirik og Kobber og Kran AS
/kontakt/                  telefon, e-post, skjema
/vilkar/                   minstefakturering, deler kunden har kjøpt selv, betaling, befaring, avbestilling
/personvern/
```

Stedssider (`/rorlegger-<sted>/`) lages ikke ved lansering. De gir tynt innhold i et lite marked. Stedsnavn skrives naturlig inn i tjenestesidene. Landbruk (vann i fjøs, frostfrie vannposter) nevnes under brønn og vann.

**Meny:**
- Kun egne sider, ingen hopp til steder på forsiden.
- På desktop: logo · Tjenester ▾ · Priser · Områder · Om Eirik · Kontakt · telefonknapp · knapp til skjemaet · NB/EN.
- På mobil: logo og ringeikon øverst, og en **fast bunnlinje med «Ring», «WhatsApp» og skjemaknappen**.

## Forsiden

Rekkefølgen følger kimkran.no. Målet er høyst omtrent 8 skjermer på mobil, med skjemaet innen omtrent 5 skjermer.

1. Toppfelt
2. Hero: liten stedslinje, stor tittel, én setning om posisjonen, faktaboks med tre løfter som kan holdes, og knappene
3. «Hva trenger du hjelp med?» med 5 nummererte kort i kundens ord og fagordet i undertittelen. Hyttekortet bytter tekst med årstiden.
4. Boksen «Det lekker nå» (se under)
5. Fastpris på varmtvannstank: stort tall merket «arbeid», typisk totalpris ved siden av, og hva som er med og ikke med. Denne erstatter blokken om elektrisk kran på kimkran.no.
6. Priser i korte trekk med regneeksempel. Erstatter oversikten over kranparken og kalkulatoren.
7. «Slik bestiller du» i tre steg
8. Om Eirik: foto, lokal tilknytning, godkjenninger (bare ekte) og dokumentasjon (FDV og våtrom). Anmeldelser vises først når de er ekte, og seksjonen er skjult til da.
9. Områder
10. Skjema
11. Bunntekst med det loven krever: Kobber og Kran AS, adresse, e-post, org.nr. med MVA, og lenker til vilkår og personvern.

**Tjenestesidene** følger malen fra kimkran.no:
- hero med brødsmuler og faktaboks
- artikkel med fast sideboks
- spørsmål og svar
- de andre tjenestene
- skjema med tjenesten forhåndsvalgt

Hver tjenesteside har egne bilder og egne fakta.

## «Det lekker nå»

Boksen er en fast tekst skrevet av et menneske. Den vises på forsiden, ved skjemaet og når kunden velger «Det lekker nå». Den sier:
- steng hovedstoppekranen, og hvor den pleier å sitte
- slå av strømmen til tanken
- tørk opp og ta bilder
- meld fra til forsikringen, som har egen skadevakt
- ring Eirik

Den sier ærlig at Eirik tar akutte oppdrag når han kan, men ikke har døgnvakt.

## Priser og ordbruk

- Begrepene i håndverkertjenesteloven brukes konsekvent: **timepris**, **prisoverslag** og **fastpris**.
- «Fastpris» brukes bare der det er fastpris. Det gjelder varmtvannstanken, og der står det at fastprisen gjelder arbeidet.
- Knappen til skjemaet sier ikke «Få pris». Teksten skal velges blant «Send forespørsel», «Send bilde» og «Få hjelp». Eieren bestemmer. Growth-vurderingen foreslår å prøve to tekster i en pilot.
- Forbrukerpriser vises med mva.
- Kveld og helg står som «etter avtale».
- Utrykning vises ikke før det finnes døgnvakt.
- Ingen badpris. Badsiden viser prosessen og at Eirik har ansvaret mot kunden når partnerne er med.
- Priser fra forretningsplanen (inkl. mva), som må bekreftes før lansering:

  | Post | Pris |
  |---|---|
  | Timepris | 1 125 |
  | Servicebil per oppdrag | 625 |
  | Forbruksmateriell | 125 |
  | Varmtvannstank, arbeid | 8 125 |

  Regneeksempel: 1 time + servicebil + forbruk = 1 875 kr, pluss deler.

## Skjemaet

**To steg, slik at kunden aldri går tapt.**

**Steg 1** lagres på serveren så snart kunden trykker videre:
- hva gjelder det (forhåndsvalgt fra siden kunden står på)
- hvor haster det: «Det lekker nå», «snart» eller «kan planlegges»
- hvor jobben er:
  - adresse med forslag fra Kartverket
  - «Bruk der jeg er nå»
  - fritekst eller gårds- og bruksnummer for hytter
- navn og telefon
- e-post er valgfritt

**Steg 2** er valgfritt:
- bilder, som lastes opp i bakgrunnen. Innsendingen venter aldri på dem.
  - Bildene komprimeres og HEIC-format håndteres.
  - Posisjonsdata fjernes fra bildene.
- beskrivelse
- felles spørsmål:
  - kommunalt vann eller brønn
  - kommunalt eller privat avløp
  - omtrentlig byggeår
  - adkomst og tilgang (nøkkel, brøytet vei)
  - om kunden foretrekker SMS eller samtale
- spørsmål for hver tjeneste:

  | Tjeneste | Spør etter |
  |---|---|
  | Varmtvannstank | bilde av typeskiltet og av tanken med gulvet rundt, rom og etasje, stikkontakt eller fast tilkobling |
  | Lekkasje | om vannet er stengt, fukt, om saken er meldt til forsikringen |
  | Tett avløp | ett eller flere avløp |
  | Brønn | borebrønn eller gravd, bilde av pumpe og trykktank, symptom, om vannprøve er tatt |
  | Bad | mål, ønsket oppstart, egne håndverkere, om styret har godkjent (borettslag) |

- «Hvor hørte du om oss?» med faste valg, valgfritt
- eget samtykke til servicepåminnelser. Avkrysningen er ikke forhåndsutfylt (markedsføringsloven § 15).

**Annet:**
- Privatkunde er forhåndsvalgt. Bedrift gir felt for firmanavn og org.nr. Det automatiske oppslaget i Brønnøysundregistrene fra kimkran.no venter.
- Kvitteringen vises på skjermen og sendes på WhatsApp, RCS eller SMS, med lenke for å sende flere bilder senere. Den lover ingen tid. Alle meldingstekster er faste og godkjent.
- Spam stoppes med et skjult felt for roboter (honningfelt) og Cloudflare Turnstile.
- Feilmeldinger står ved feltet og inneholder alltid telefonnummeret.

## AI-sortering

Når en forespørsel kommer inn, lager AI-en et sammendrag for Eirik. Det inneholder:
- **hast:** er det vann på avveie nå?
- **jobbtype og omtrentlig verdi**
- **kjøretid fra Hemnes**
- **grovt prisanslag** fra prislisten
- **hva som mangler**, for eksempel at bildet er for dårlig eller at typeskiltet mangler
- **jobber Eirik ikke tar:** elektro, spyling, utenfor området
- **røde flagg:** «kjøpt delene selv», «bare montere», «billigst», «en annen har begynt», «kontant»
- **et svarutkast** som Eirik selv sender eller kaster

Sammendraget, de originale svarene og bildene går bare til Eirik. Forespørselen lagres strukturert, slik at AI-kontoret senere kan bruke den. Lagres skal jobbtype, sted, koordinater, hast, status og kilde.

## Meldingskanaler: WhatsApp først, RCS, SMS som reserve (eiers beslutning)

Eirik får et **nytt bedriftsnummer**, som brukes til telefon, WhatsApp og SMS. Budsjett er ikke satt ennå.

- **WhatsApp Business er hovedkanalen.**
  - Nettsiden har en «Chat på WhatsApp»-knapp på forsiden, tjenestesidene og kontaktsiden, og i bunnlinjen på mobil ved siden av «Ring». Knappen åpner WhatsApp med en ferdig hilsen som inneholder tjenesten og kilden.
  - Nummeret kjører WhatsApp Business-appen på Eiriks telefon og WhatsApp Business Platform (Cloud API) samtidig. Meta kaller dette «coexistence». Da kan Eirik chatte selv i appen, mens systemet sender faste maler.
- **Automatiske meldinger:** kvittering og melding ved tapt anrop sendes som **godkjente WhatsApp-maler** når kunden kan nås på WhatsApp. Ellers sendes de som **RCS**, og deretter som **SMS**.
  - Teksten er den samme i alle kanaler og er godkjent av eieren.
  - AI skriver aldri fritt til kunden. Svar fra kunder går til Eirik.
- **RCS** vurderes av byggeren. I 2026 støtter Telenor og Telia det, og omtrent 20 % av mottakerne i Norge kan nås. Støtten på iPhone er usikker. Er det dyrt eller tungvint å få til ved lansering, kan RCS komme senere, med SMS som reserve.
- **Samtykke:** at kunden vil ha meldinger på WhatsApp registreres i skjemaet eller oppstår når kunden selv har startet chatten. Det skilles fra samtykke til servicepåminnelser.

## Tapte anrop

Bedriftsnummeret går via en telefonitjeneste som melder fra om ubesvarte anrop. Anropet settes over til Eiriks mobil. Når et anrop ikke blir besvart, får den som ringte en fast, godkjent melding på WhatsApp, RCS eller SMS, i den rekkefølgen. Meldingen har lenke til skjemaet (`?kilde=tapt-anrop`) og til WhatsApp-chat. Eirik får beskjed om det tapte anropet sammen med forespørslene. Ingen AI snakker med kunden på telefonen i denne fasen.

Hvis anrop direkte i WhatsApp ikke kan meldes til systemet, gjelder løsningen for tapte anrop bare vanlige telefonanrop. Det må verifiseres i Metas dokumentasjon.

## Redigering i CMS (eiers beslutning)

Følgende kan endres i Sveltia CMS på begge språk, uten kode:
- firmadata (navn, telefon, WhatsApp-nummer, org.nr., adresse, e-post)
- priser og område
- spørsmål og svar per tjeneste
- fakta i faktaboksene
- boksen «Det lekker nå»
- teksten i kvitteringen og meldingen ved tapt anrop
- godkjenninger, referanser og anmeldelser, med feltet «vis bare når ekte»

Sidene, de strukturerte dataene for Google og lanseringssperren leser fra de samme datafilene. Skjemaets spørsmål per tjeneste ligger i kode.

## Måling uten sporing

- Ingen sporingsskript, cookies eller lagring i nettleseren.
- Kilden fanges med `?kilde=` på egne lenker og QR-koder, og legges i et skjult felt i skjemaet.
- I tillegg kommer svaret på «Hvor hørte du om oss?».
- Telling skjer på serveren ved innsending, og står beskrevet i personvernerklæringen.
- Sidevisninger hentes fra Cloudflares samlede statistikk.

## Plassholdere og sperre mot lansering

- **Firmadata ligger ett sted:** navn, telefon, org.nr., adresse, e-post og priser. De brukes både av sidene og av strukturerte data for Google.
- **Plassholdere** brukes for telefon (`000 00 000`), org.nr., adresse, godkjenninger (de vanligste for en rørlegger, merket), bilder, jobber og referanser. De har et fast merke.
- **Eksempelanmeldelser og referanser** vises bare med merket «Eksempel» og bare utenfor produksjon.
- **Sperren:** en sjekk i byggesteget feiler når en bygg ment for lansering inneholder plassholdermerket. Endringen berører `scripts/` og CI, så den må gjennom vanlig PR med godkjenning.
- **Bildebeskrivelser:** en egen liste med beskrivelser til Grok Imagine leveres som en del av arbeidet.

## Visuelt

- Merkevaren i `brand/`: krem, sjokoladebrun og kobberoransje, Inter og Rubik, avrundede former, kontrast etter `tokens.css`.
- Lånt fra kimkran.no: liten linje over stor tittel, nummererte kort, tre steg, faktaboks og sideboks.
- Ikke lånt: monospace-etiketter, skråstilt tekst, kran- og kjettinganimasjon og stripe om døgnvakt.

## Teknisk

Bygger på grunnmuren: Astro statisk på Cloudflare Workers, nb og en, Sveltia CMS.

- **Server:** skjema, AI-sortering, meldinger og tapte anrop kjører på Workers. Data lagres i D1 og bilder i R2, i Europa. Alt sendes til Eirik bare på kanaler han selv har satt opp.
- **Strukturerte data for Google:** typen `Plumber` med `areaServed`, `WebPage`, `Service`, `BreadcrumbList` og `FAQPage`. Ingen `aggregateRating`.
- **Bilder og fonter:** Astro `<Image>` med `srcset`, og preload av bare de fontvektene som brukes.
- **Tilgjengelighet:** WCAG 2.1 AA.

## Avklaringer etter byggersjekken (byggerens valg, markert)

- **Lanseringssperre og deploy (fakta + mitt valg):** Domenet er ikke koblet på. `main` deployer fortsatt til Worker-en `kobberogkran`, som står bak Cloudflare Access (Scope «All traffic") – `main` er altså i praksis et lukket testmiljø fram til lansering. Sperren styres av en byggvariabel `LAUNCH=true` som eieren setter i Workers Builds på lanseringsdagen (sammen med Access-scope → «Previews only» og custom domains). Uten variabelen tillates plassholdere; med den feiler bygget hvis plassholdermerket finnes. Ingen endring i deploy-flyten eller `wrangler.jsonc` trengs for dette.
- **Ansvarsdeling (mitt valg):** Agenter skriver kode, `wrangler.jsonc`-endringer (via PR med menneskelig godkjenning) og runbooks. Eieren oppretter selv i Cloudflare: D1, R2 (EU), Turnstile, secrets for meldinger og AI, kontoer hos telefoni- og meldingsleverandør, og verifisering av bedriften hos Meta (WhatsApp). Planen har egne «eier-steg» i rekkefølge.
- **Én Worker (mitt valg):** Serverrutene (skjema, opplasting, webhooks for telefoni og meldinger) ligger i samme Worker via Astro-adapterens server-rendrede ruter. Resten er forhåndsrendret.
- **Område (mitt valg, plassholder):** Stedene fra forretningsplanen (Hemnes, Bjørkelangen, Aurskog, Løken, Setskog, Rømskog, Lillestrøm). Grensen for «utenfor området» settes som maks kjøretid fra Hemnes, plassholder 45 min, som eieren bekrefter før lansering.
- **Datamodell (mitt valg):** AI-kontoret skal bruke samme D1-database. Skjemaet har derfor kunde-, forespørsel- og samtykketabeller med ID-er og status fra start, ikke bare én forespørselstabell.
- **Engelske adresser (mitt valg):** Engelske slugger (`/en/services/water-heater/`), koblet via `translationKey` som i grunnmuren.

## Overlatt til byggeren

- Valg av leverandører for det nye nummeret og meldingene:
  - telefonitjeneste med melding om tapte anrop og videresending til mobilen
  - WhatsApp-leverandør (direkte Cloud API eller en BSP som støtter coexistence)
  - RCS- og SMS-leverandør (for eksempel en nordisk aggregator)
  - data lagres i EU
  - byggeren legger fram kostnad, eieren bestemmer.
- Valg av AI-modell og leverandør til sorteringen, innenfor en lav fast månedskostnad.
- Kanal for beskjed til Eirik: SMS, e-post eller begge.
- Lagringstid for forespørsler og bilder, beskrevet i personvernerklæringen.
- Nøyaktig layout, avstander og komponentdesign innenfor merkevaren.
- Arbeidstitler på sidene. Endelig tekst skrives eller godkjennes av et menneske.

## Utkast som må skrives eller godkjennes av et menneske

- Alle tekster på begge språk
- Meldingsmalene: kvittering og tapt anrop (WhatsApp-maler må også godkjennes av Meta)
- Boksen «Det lekker nå»
- Vilkårssiden
- Personvernerklæringen
- Teksten på knappen til skjemaet
