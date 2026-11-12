# Tilbakemelding: growth-perspektiv

Dato: 2026-11-12. Simulert vurdering. En AI-agent har spilt rollen som en Silicon Valley-growth-rådgiver og lest [kimkran-analysen](2026-11-12-kimkran-analyse.md). Dette er ikke en ekte person.

## Hva som konverterer
- Fem tjenester beskrevet ut fra kundens problem
- Fast bunnlinje på mobil
- Skjema på hver side, forhåndsutfylt etter siden kunden står på
- Priser inkl. mva med et regneeksempel
- Fastpris på bereder og «pris før start»

Åpne priser er sjeldne i bransjen og bygger tillit før anmeldelsene finnes.

## Lekkasjer
1. **Tapte anrop er den største lekkasjen**, og nettsiden løser den ikke. Foreslått løsning: ubesvart anrop gir en fast, godkjent SMS med lenke der kunden kan sende bilde. Dette blir første modul i AI-kontoret.
2. **Telefonnummeret kommer etter bildeopplastingen.** Det kan gå tapt på dårlig 4G. Foreslått løsning: skjema i to steg.
   - Steg 1: hva, hvor og telefon. Lagres med en gang.
   - Steg 2: bilder og beskrivelse, valgfritt. Bildene lastes opp i bakgrunnen, og HEIC-formatet må håndteres.
   - Kvitteringen har en lenke for å «sende flere bilder senere».
3. **Påkrevd e-post gir unødvendig friksjon.** Bruk SMS eller kvittering på skjermen, og gjør e-post valgfri.
4. **Hytter mangler ofte ordentlig adresse.** Tillat fritekst og gårds- og bruksnummer, og gjør «Bruk der jeg er nå» til hovedvalget.
5. **«Få pris» lover for mye.** Test «Send bilde» i stedet.
6. **«Lekker nå» bør vise mer enn ringeknappen.** Vis også en kort hjelpetekst om hvordan man stenger vannet, skrevet av et menneske.

## Lokal SEO
- **Kartvisningen fra Google-profilen er omtrent 80 % av effekten.**
  - Opprett profilen nå, som et tjenesteområde uten synlig adresse.
  - Legg ut ekte bilder hver uke.
  - Bruk nøyaktig samme navn, adresse og telefon overalt.
- **Anmeldelser:** det som teller er at de kommer jevnt. Familie og venner skal ikke skrive anmeldelser.
- **Stedssider:** sju stedssider gir tynt innhold. Start med `/omrader/` og høyst Hemnes og Lillestrøm. Satse heller på hytte- og brønnsider.
- **Strukturerte data:**
  - Bruk typen `Plumber` med `areaServed`.
  - Ingen `aggregateRating`.
  - Behold FAQ, men ikke regn med rike resultater i søk.

## Måling uten sporing
- **`?kilde=` på egne lenker og QR-koder.** Verdien legges i et skjult felt i skjemaet, uten lagring på enheten, og telles på serveren.
- **«Hvor hørte du om oss?»** som valgfritt felt, med valget «Kragtorp-kunde før».
- **Gratis kilder:** statistikken i Google-profilen og den samlede trafikkstatistikken i Cloudflare.
- **Ett hovednummer overalt.**
- **Tavle med fem tall hver uke:** forespørsler, anrop, kilde, vunnet og anmeldelser.

## Inngang til AI-kontoret
- **Strukturerte felter:**
  - eiendomstype
  - vann og avløp: kommunalt eller privat
  - hvor gammelt utstyret er
  - om kunden foretrekker SMS eller samtale
  - hytte: tilgang og nøkkel
- **Eget samtykke til servicepåminnelser.** Avkrysningen skal ikke være forhåndsutfylt (markedsføringsloven § 15).
- **Anmeldelses-SMS til alle kunder når jobben er ferdig.** Ingen filtrering på hvem som får den. Legg i tillegg QR-kode i bilen og lenke på fakturaen.
- **Kragtorp:**
  - Spør bostyrer om kundeporteføljen.
  - Ikke bruk Kragtorp-navnet i annonser.
  - En nøytral side «Trenger du ny fast rørlegger?» er grei.
- **Hytter:** venteliste for vinterstengning og åpning.

## Dropp ved lansering
- Oppslaget i Brønnøysundregistrene
- Fem av sju stedssider
- «Book nå» hvis det ikke stemmer
- Fullt engelsk speil av siden. Det er eiers beslutning.

## Mangler
- Håndtering av tapte anrop
- SMS-kvittering
- Når Eirik tar telefonen (tidspunkt, ikke svartid)
- Hjelp til å stenge vannet
- Plan for Google-profilen og katalogoppføringer
- B2B-side for byggmestre
- Ekte foto av Eirik

## Pilotforsøk de første 90 dagene
Dette er piloter, ikke A/B-tester, fordi trafikken er for lav.
1. **CTA-tekst:** «Send bilde» mot «Få pris», annenhver uke.
2. **Tidspunkt for anmeldelses-SMS:** samme kveld mot neste morgen.
3. **Venteliste for hytter:** del i to Facebook-grupper med `?kilde=` og se hvilken som gir flest påmeldinger.

## Topp 7
1. Google-profilen og flyten for anmeldelser
2. SMS ved tapt anrop, med lenke for å sende bilde
3. Skjema i to steg, valgfri e-post og kvittering på SMS
4. Bunnlinje med «Ring» og «Send bilde», og «Lekker nå» med hjelp til å stenge vannet
5. Strukturerte felter og eget samtykke til påminnelser
6. Kutt til 1–2 stedssider, og satse på hytte- og brønnsider
7. `?kilde=` på egne lenker, tavle med fem tall hver uke, og henvendelse til bostyrer
