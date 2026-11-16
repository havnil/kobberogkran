# Slik bidrar du til nettsiden

For deg som vil rette tekst, bytte et bilde eller gjøre en liten endring, uten å kunne kode.

Kort fortalt: du gjør endringen, GitHub lager en **forespørsel om endring** (en PR), du ser
resultatet på en **forhåndsvisning**, og Håvard godkjenner før det går live. Du kan ikke ødelegge
nettsiden: ingenting går ut før noen andre har sagt ja.

## Ordliste

| Ord | Betyr |
| --- | --- |
| **Repo** | Mappa med alt som er nettsiden: <https://github.com/havnil/kobberogkran> |
| **`main`** | Den versjonen som er live. Ingen kan endre den direkte. |
| **Gren (branch)** | En kopi der du gjør endringene dine, uten å røre `main`. |
| **PR (pull request)** | «Vil dere ta inn endringene mine?» Her ser man hva som er endret, og her godkjenner Håvard. |
| **`ci`** | Den automatiske sjekken som kjører på hver PR. Grønn hake = alt bygger. Rødt kryss = noe er feil. |
| **Forhåndsvisning (preview)** | En lenke Cloudflare legger i PR-en, der du ser siden med endringene dine før de går live. |
| **Flette (merge)** | Når PR-en tas inn i `main`. Da er endringen live etter noen minutter. |

## Før første gang

1. Lag en gratis konto på <https://github.com> og send brukernavnet til Håvard.
2. Håvard legger deg til. Du får en e-post fra GitHub: trykk **Accept invitation**.
3. Håvard legger e-posten din inn i innloggingen for forhåndsvisningene. Første gang du åpner en
   forhåndsvisning, skriver du e-posten din og får en kode på e-post.

## Hvor ligger det du vil endre?

Alt som er tekst og bilder ligger i noen få mapper. Rør bare disse:

| Det du vil endre | Fil |
| --- | --- |
| Teksten på en side (Om oss, Kontakt, Priser …) | `src/content/pages/nb/<side>.md` og den engelske i `src/content/pages/en/` |
| En tjeneste (Lekkasje, Bad, Varmeanlegg …) | `src/content/tjenester/nb/<tjeneste>.md` og `src/content/tjenester/en/` |
| Knapper, skjemaet, forsiden, bunnteksten | `src/content/tekster/nb.json` og `en.json` |
| Telefon, e-post, priser, steder | `src/content/firma/firma.json` |
| Referanseprosjekter | `src/content/prosjekter/` |
| Bilder | `public/images/uploads/` |

Tre regler:

- **Begge språk.** Endrer du en norsk tekst, endre den engelske også, eller skriv i PR-en at den
  engelske må oppdateres.
- **I `.json`-filer:** behold anførselstegn og komma nøyaktig som de står. Skriv bare inne i
  `"…"`. Et manglende komma gjør at `ci` blir rød (det er ufarlig, men må rettes).
- **Alt annet** (kode, `scripts/`, `.github/`, `wrangler.jsonc` og lignende) lar du være. Trenger
  noe der endring, bruk `@claude` (se under) eller spør Håvard.

## Måte 1: Rett tekst rett på GitHub (enklest)

Passer for skrivefeil, en setning, en pris eller et telefonnummer.

1. Åpne repoet og trykk tasten **t**. Skriv en del av filnavnet, for eksempel `kontakt`, og velg filen.
2. Trykk **blyanten** oppe til høyre over teksten («Edit this file»).
3. Gjør endringen.
4. Trykk den grønne knappen **Commit changes…**.
5. Skriv kort hva du har gjort, for eksempel «Rettet skrivefeil på kontaktsiden».
6. Velg **Create a new branch for this commit and start a pull request**. Trykk **Propose changes**.
7. På neste side: trykk **Create pull request**.
8. Vent et par minutter. Nederst i PR-en kommer:
   - en grønn hake ved `ci` når alt bygger
   - en kommentar fra Cloudflare med en **preview-lenke**. Åpne den og se at endringen ser riktig ut.
9. Si fra til Håvard at PR-en er klar. Når han godkjenner og fletter, er den live etter noen minutter.

**Vil du endre mer i samme PR?** Åpne PR-en, trykk fanen **Files changed**, trykk **⋯** ved filen
og **Edit file**. Eller åpne en annen fil og pass på at du står på **din gren** (nedtrekksmenyen
oppe til venstre viser grennavnet) før du trykker blyanten, og velg **Commit directly to the
…-branch** til slutt.

**Bytte et bilde:** gå til `public/images/uploads/`, trykk **Add file → Upload files**, dra inn
bildet, og velg **Create a new branch …** som over. Si i PR-en hvor bildet skal brukes, så kan
`@claude` koble det inn.

## Måte 2: Be Claude gjøre det (`@claude`)

Passer når du ikke vet hvilken fil det gjelder, når endringen berører flere filer, eller når noe
må endres i koden.

1. Åpne fanen **Issues → New issue**.
2. Skriv hva du vil ha, og ta med `@claude`. Jo mer konkret, jo bedre. Eksempler:
   - «@claude Bytt «Vi kommer når det er avtalt» til «Vi kommer til avtalt tid» på forsiden, på norsk og engelsk.»
   - «@claude Legg til Fetsund som sted under Lillestrøm, også på kartet.»
   - «@claude Bildet av badet på referansesiden er for mørkt, bytt det med bad-2.jpg som jeg har lastet opp.»
3. Trykk **Create**. Claude svarer i saken og lager en PR, vanligvis i løpet av noen minutter.
4. Åpne PR-en, se på preview-lenken, og skriv `@claude …` i en kommentar hvis noe skal justeres.
5. Si fra til Håvard når den er klar.

Godt å vite:

- Claude bruker Håvards Claude-abonnement. Én bestilling med alt du vil ha er bedre enn ti små.
- En PR fra `@claude` flettes aldri automatisk. Håvard godkjenner alltid.
- Er `ci` rød i en PR, kan du skrive «@claude ci feiler, kan du rette det?» i PR-en.

## Måte 3: Claude Code på egen maskin

Når du vil gjøre større ting selv. Installer Claude-appen, åpne fanen **Code**, og velg repoet. Spør
Håvard om hjelp første gang. Prosjektets regler står i `CLAUDE.md`, og Claude følger dem.

## Måte 0: Innholdsverktøyet (`/admin`)

Nettsiden har et redigeringsverktøy på `kobberogkran.no/admin`. Der endrer du tekst, priser og
referanser i et skjema, uten å se filer. Det er den enkleste måten for Eirik å legge ut nye
referanseprosjekter.

1. Gå til `/admin` og logg inn med GitHub.
2. Velg for eksempel **Referanser → Ny**. Fyll ut, last opp bildene og trykk **Lagre**. Lagringen
   blir et utkast med en egen PR, og ingenting er live ennå.
3. Trykk **Publiser**. Når den automatiske sjekken (`ci`) er grønn, går det live etter noen minutter.
   Har du ikke lov til å publisere uten godkjenning, venter utkastet til Håvard godkjenner det.

Verktøyet virker først når Håvard har satt opp innloggingen (se `cloudflare-setup.md`).

## Når noe går galt

| Det som skjer | Gjør dette |
| --- | --- |
| Rødt kryss ved `ci` | Trykk **Details** for å se feilen, eller skriv «@claude ci feiler, kan du rette det?» i PR-en. |
| Ingen preview-lenke etter ti minutter | Si fra til Håvard. |
| Preview-lenken ber om innlogging | Skriv e-posten din og bruk koden du får på e-post. Virker det ikke, er du ikke lagt til ennå. |
| Du angrer en PR | Trykk **Close pull request** nederst. Ingenting har skjedd med nettsiden. |
| Noe ser feil ut etter at det er live | Si fra til Håvard. Alt kan rulles tilbake ([rollback.md](rollback.md)). |
