# Growth-vurdering av det nye nettsideutkastet

Dato: 2026-11-13. **Simulert vurdering.** En AI-agent har spilt rollen som en growth-rådgiver fra Silicon Valley som nå jobber med lokale håndverksbedrifter i Norge. Dette er ikke en ekte person, og rådene må vurderes av eieren.

Grunnlag: utkastet på grenen `design/kimkran-oppsett` (skjermbilder av forsiden på desktop og mobil, varmtvannstanksiden, priser og kontakt), `Forside.astro` med komponentene, `tekster/nb.json`, tjenestesidene, `firma.json`, og de to vurderingene fra 2026-11-12 ([growth](2026-11-12-tilbakemelding-growth.md), [rørlegger](2026-11-12-tilbakemelding-rorlegger.md)).

Alle priser og tall under er eksempler. Eieren bestemmer dem, og ingenting her lover tid, døgnvakt eller anmeldelser som ikke finnes.

## Kort oppsummert

- **Utkastet er godt på tillit og pris.** Faktakort med priser, fastpris på tank med «med / ikke med», tanksjekken og ærlig «ingen døgnvakt» er bedre enn det meste i bransjen.
- **Men forsiden er for lang og snakker bare om ulykker.** På mobil er forsiden rundt 17 skjermer. Skjemaet kommer først på skjerm 12–13, målet var 5. Overskriften «Hva har skjedd?» rammer alt inn som skade.
- **Det største hullet er forebygging.** Det er der en ny enmannsbedrift kan fylle kalenderen i rolige uker, og det er det dere vil kjøpe annonser til. I dag finnes ingen side som selger det.
- **Annonser bør gå til egne landingssider per kampanje,** ikke til forsiden.
- **Wedge: «Lekkasjesikker hytte»** – hytteåpning og vinterstengning, med vannstopper og fjernstenging til fast pris på arbeidet (seksjon 7).
- **Fra det gamle utkastet** bør Ring først i hero, de tre løftene, regneeksemplet og Om Eirik tas med (seksjon 8).

---

## 1. Er rekkefølgen på forsiden riktig?

### Slik er den i dag

| # | Seksjon | Mobilskjerm (ca.) | Vurdering |
|---|---|---|---|
| 1 | Hero med faktakort (priser, kjøretid) | 1–2 | Bra. Men «Kjøretid fra Hemnes 45 min» kan leses som en lovnad om oppmøtetid. |
| 2 | «Hva har skjedd?» – 8 ruter | 2–4 | Bra å ha tidlig. 8 ruter er for mange, og alle er skader. |
| 3 | Servicebilen (utstyr med «bruk 4 av 5») | 5–6 | Lav verdi for kunden. Tallene er oppdiktet (`bekreftet: false`). |
| 4 | Fastpris på varmtvannstank | 6–7 | Sterk. Riktig å fremheve. |
| 5 | Tanksjekk | 7–8 | Den beste seksjonen på siden. Bør sitte rett ved tanken. |
| 6 | Bånd «På vei i Hemnes og Aurskog-Høland» | 8 | Pynt. Én skjerm uten handling. |
| 7 | Områder + «Dette sier kundene» | 9–10 | Omtalene er eksempler og må være skjult ved lansering. |
| 8 | Slik bestiller du | 10–11 | Greit, men kommer for sent. |
| 9 | Skjema + «Lekker det nå?» | 12–16 | Viktigst, men lengst ned. «Lekker det nå?» havner under telefonnummeret, langt ned. |

Det som mangler på forsiden: **Om Eirik** (ansikt, lokal, ny bedrift), **dokumentasjon** (FDV, Boligmappa), og **forebyggende tjenester**.

### Rekkefølgen jeg ville brukt

| # | Seksjon | Hvorfor |
|---|---|---|
| 1 | **Hero:** tittel, én linje om posisjonen, tre knapper (Ring · WhatsApp · Send bilde), når Eirik tar telefonen, faktakort med priser | Kunden skal kunne handle før første scroll. Tidspunkt for telefonen er ikke en svartid. |
| 2 | **«Lekker det nå?»-stripe:** én linje med «Steng hovedstoppekranen → slik gjør du» som åpner punktlisten | Den akutte kunden trenger det på 3 sekunder, ikke etter 12 skjermer. Kompakt, så den ikke skremmer planleggerne. |
| 3 | **To dører:** «Noe er galt nå» (4 ruter) og «Unngå at det skjer» (4 ruter) | Fanger begge kjøpsmodusene. Gjør forebygging synlig uten egen lang seksjon. |
| 4 | **Varmtvannstank:** fastpris + tanksjekken slått sammen til én seksjon | Tanksjekken er kroken, fastprisen er tilbudet. De hører sammen. |
| 5 | **Sesongkortet:** det som er aktuelt nå (høst: vinterstengning og frostfri utekran; vår: hytteåpning og brønnsjekk) | Gir en grunn til å bestille *nå*. Gjenbruk `aktivSesong` som allerede styrer hero-merket. |
| 6 | **Om Eirik:** foto, «nytt firma fra 2027», fagbrev og godkjenninger som faktisk finnes, dokumentasjon (FDV, Boligmappa) | Tillit før skjemaet. Ærlig om at bedriften er ny, sterk på at det er én person med ansvar. |
| 7 | **Skjema** med «Slik bestiller du» som tre linjer i ingressen | Skjemaet bør komme innen skjerm 7–8 på mobil. Stegene er en forklaring, ikke en egen seksjon. |
| 8 | **Områder** som én kompakt linje med stedsnavn | Viktig for Google og for «tar han hit?», men trenger ikke en hel skjerm. |
| — | **Omtaler:** skjult til de finnes. Deretter rett over skjemaet. | Ingen eksempler i produksjon. |
| — | **Fjern fra forsiden:** Servicebilen og båndet | Flytt servicebilen til Om Eirik når tallene er ekte. Båndet kan bli bakgrunn i Om Eirik-seksjonen. |

Mål: maks 8 mobilskjermer, skjemaet innen skjerm 7.

---

## 2. Tilbyr vi de riktige tjenestene?

Kjernen (service, tank, brønn, hytte, bad) er riktig for området. Det som mangler, er de små forebyggende jobbene som er lette å selge på nett.

| Tjeneste | I dag | Forslag |
|---|---|---|
| Lekkasje og tett avløp | Egen side | **Behold.** Hovedinngangen for akutte jobber. |
| Varmtvannstank | Egen side, fastpris | **Behold og løft.** Den beste jobben for en ny bedrift. |
| Brønn og vann (inkl. fjøs) | Egen side | **Behold.** Legg til «brønnservice hvert år» (UV-lampe, filter, trykktank). |
| Hytte | Egen side | **Behold.** Legg til «hytteavtale» (fast rutine, samme pris hvert år etter første besøk). |
| Bad | Egen side, rute 4 | **Behold siden, flytt ned.** Lang salgssyklus, avhenger av partnere og godkjenninger. Ikke en vekstmotor år 1. |
| **Lekkasjesikring / vannstopper** | Bare nevnt under tank | **Ny side eller egen seksjon.** Forsikring og TEK17 er triggeren. |
| **Rørsjekk (gjennomgang av huset)** | Mangler | **Ny fastprisjobb.** Inngangsprodukt som gir oppfølgingsjobber. |
| **Stoppekran og hovedstoppekran** | Én linje i «typiske jobber» | **Egen fastpris.** Folk oppdager at den sitter fast når de leser «Lekker det nå?». |
| **Frostfri utekran** | Én linje | **Egen fastpris, sesongvare** (august–oktober). |
| **Montering av oppvask- og vaskemaskin med vannstopper** | Én linje | **Egen fastpris.** Butikkene leverer, men kobler sjelden til vann. |
| Fjøs og gård | Rute → brønnsiden | **Behold som rute.** Godt nisjesignal lokalt. |
| Bedrift og borettslag | Rute → servicesiden | **Endre.** Ruten lover noe siden ikke svarer på. Lag en kort side for styrer (se 3 og 6), eller fjern ruten til siden finnes. |

**Slå sammen:** «Det lekker» og «Tett avløp» kan være én rute («Lekker, drypper eller er tett»). Da blir det plass til forebygging uten flere ruter.

**Ikke legg til nå:** varmepumpe, spyling, døgnvakt, slamtømming, nye stedssider.

---

## 3. Små jobber som gir volum raskt

Rangert etter hvor fort de fyller kalenderen for én person uten anmeldelser. Fastprisene gjelder arbeid; tall settes av eieren.

| # | Jobb | Hvem kjøper | Trigger | Slik selges den | Fastpris? |
|---|---|---|---|---|---|
| 1 | **Bytte varmtvannstank** | Huseiere 40+ med tank fra før ca. 2010 | Tanken nærmer seg 20 år; forsikring som avkorter; TG2/TG3 i tilstandsrapport; rust eller drypp | Tanksjekken som krok → «send bilde av typeskiltet» → pris uten befaring | Ja, finnes |
| 2 | **Lekkasjesikring / vannstopper** (ved tank, kjøkken, vaskemaskin) | Huseiere, nye kjøpere, borettslag | Forsikringsvilkår og eventuelle rabatter, TEK17-krav ved nytt utstyr, tilstandsrapport | Selges *sammen med* tankbytte og som egen jobb: «Under 1 time, fast pris» | Ja, per type |
| 3 | **Vinterstengning og åpning av hytta** | Hytteeiere fra Oslo og Lillestrøm med hytte i Setskog, Rømskog, Hemnes | Første frostnetter (sep–okt), påske og mai | Venteliste per område, så Eirik kjører én rute per dag. Påminnelse neste år med samtykke. | Ja, etter første besøk |
| 4 | **Rørsjekk** (gjennomgang på ca. 1 time) | Nye boligkjøpere, selgere før takst, eldre som vil «ha det i orden» | Boligkjøp eller -salg, tilstandsrapport, forsikringsfornyelse | Fast pris, skriftlig liste med TG-lignende vurdering og pris på hvert punkt. Lastes opp i Boligmappa. | Ja |
| 5 | **Bytte stoppekran / hovedstoppekran** | Alle med hus fra før 1990 | Kranen lar seg ikke stenge; «Lekker det nå?»-teksten | «Sjekk om din stoppekran virker» → fast pris på bytte | Ja |
| 6 | **Frostfri utekran** | Huseiere med hage | August–oktober, etter en frostsprengt kran | Sesongkort og Facebook-grupper i bygda | Ja |
| 7 | **Brønnservice** (UV-lampe, filter, trykktank, råd om vannprøve) | Alle med privat brønn, gårdsbruk | Årlig lampebytte, brunt vann, pumpe som går hele tida | «Brønnservice hvert år» med påminnelse (samtykke) | Ja, grunnpakke |
| 8 | **Montering av oppvask- og vaskemaskin** med vannstopper | Folk som nettopp har kjøpt maskin | Ny maskin levert | «Fast pris på tilkobling, vannstopper inkludert eller som tillegg» | Ja |
| 9 | **Bytte blandebatteri / toalett** | Alle | Drypp, renner, oppussing | Fast pris på arbeid når Eirik leverer delen | Ja, på arbeid |
| 10 | **«Rørleggerdag» i borettslag og sameier** | Styret, så beboerne | Årsmøte, vedlikeholdsplan, forsikringskrav | Styret bestiller én dag; beboerne booker små jobber (stoppekran, vannstopper, kraner) | Ja, per jobb |

**Logikken:** jobb 1–3 gir omsetning, jobb 4–5 gir nye kunder som blir faste, jobb 3 og 7 gir gjentakende jobber hvert år. Alle har en tydelig utløser som kan brukes i annonser og påminnelser.

**Samle besøket:** én servicebil, flere småjobber. Skjemaet bør ha «Har du flere små ting? Skriv dem her», og tilbudet «stoppekran + vannstopper samme besøk».

---

## 4. Er det lett å ta kontakt?

### Antall trykk på mobil

| Kanal | Trykk | Merknad |
|---|---|---|
| **Ring** | 2 (bunnlinje «Ring» → bekreft oppringing) | Bra. Men det finnes ikke ringeikon i toppen på mobil, slik designet sa. |
| **WhatsApp** | 3 (bunnlinje → åpne app → send ferdig hilsen) | Bra. Mangler i hero og i skjemaseksjonen. |
| **Skjema, kort vei** | ca. 9–11 trykk + 3 tastaturer: «Send forespørsel» → hva gjelder det → hvor fort → adresse (skriv eller «Bruk der jeg er nå» + tillat posisjon) → navn → telefon → (Privat er valgt) → send | For mye i steg 1 for den som bare vil bli ringt. |

### Friksjonspunkter

1. **Skjemaet er 12–13 skjermer ned** på mobil. Knappen hopper dit, men den som scroller, gir opp før.
2. **Adressen kreves i steg 1.** For en tilbakeringing holder det med hva, navn og telefon. Adressen kan komme i steg 2 eller i samtalen.
3. **Ingen «ring meg tilbake».** Mange eldre vil verken skrive eller vente i kø. Et valg «Ring meg» med navn og nummer er den korteste veien.
4. **Ringeknappen er minst i bunnlinjen,** mens «Send forespørsel» er størst. På bygda bør Ring og skjema være like store.
5. **Ingen tekst om når Eirik tar telefonen.** «Tar telefonen hverdager 07–16, ellers ring tilbake samme dag eller neste» (eksempel, ikke en svartid-garanti) senker terskelen for å ringe og for å vente.
6. **Bilde er hovedargumentet** («send bilde av typeskiltet»), men bildene kommer først i steg 2. Gi en egen knapp «Send bilde på WhatsApp» der det står «send bilde».
7. **«Lekker det nå?» står under e-post og adresse**, langt nede. Toppmenyen lenker dit, men på mobil ligger den i menyen.
8. **Kjøretid 45 min i faktakortet** kan leses som oppmøtetid. Skriv det som område: «Kjører inntil ca. 45 min fra Hemnes».
9. **Bunnlinjen tar plass på hver skjerm.** Greit, men skriften er 13 px og «Send forespørsel» brytes på to linjer. Prøv «Send bilde» eller «Skriv» for kortere tekst.
10. **Telefonnummer og e-post er plassholdere.** Selvsagt nå, men husk ett nummer overalt (Google-profilen, bilen, faktura).

---

## 5. Viser vi tjenester kunden ikke har tenkt på?

Delvis. Tanksjekken er et godt eksempel på forebygging: kunden oppdager et problem selv. Ellers er alt formulert som skade («Hva har skjedd?», «Det lekker», «Tett avløp»). Hytte og brønn har sesongtekst, men den er gjemt i rutene.

### Hva bør legges til, og hvor

| Hva | Hvor | Form |
|---|---|---|
| **«Unngå at det skjer»**-dør med 4 ruter: tanksjekk, vannstopper, stoppekran, hytte/brønn i sesong | Forsiden, rett etter «Noe er galt nå» | Samme rutedesign, egen overskrift |
| **«Sjekk stoppekranen din»** (30 sek: finn den, prøv å stenge, går den tungt → bytt) | I «Lekker det nå?» og som rute | Liten interaktiv sjekk som tanksjekken, ingen lagring |
| **Kryss-salg på tanksiden:** «Mangler sluk eller vannstopper? Ta det samtidig» | Varmtvannstanksiden, ved «Ikke med i fastprisen» | Pris eller fra-pris på vannstopper rett ved siden |
| **Kryss-salg på servicesiden:** «Mens Eirik er der: sjekk stoppekran, vannstopper ved oppvaskmaskinen» | «Samle opp småjobbene» finnes – gjør det til en avkrysningsliste i skjemaet | Avkrysning, ikke forhåndsutfylt |
| **Sesongkort** | Forsiden, etter tanken | Bytter etter `aktivSesong`: høst = vinterstengning + frostfri utekran, vinter = frosne rør + tanksjekk, vår = hytteåpning + brønnservice, sommer = boligsalg + rørsjekk |
| **Rørsjekk** | Egen side + rute i «Unngå at det skjer» | Fast pris, hva sjekkes, hva du får (skriftlig liste, Boligmappa) |
| **Påminnelser** | Kvitteringen og hytte-/brønnsidene | «Vil du ha en påminnelse om tanken om X år / hytta neste høst?» med eget, tomt samtykkefelt |

---

## 6. Er forsiden riktig landingsside for annonser om vedlikehold?

**Nei.** Forsiden skal fange de som kommer fra Google-profilen, bilen og jungeltelegrafen, og den må dekke alt. En annonse om vedlikehold lover én ting; landingssiden må handle om nøyaktig den tingen, ha ett tilbud og ett skjema med jobben forhåndsvalgt. Ellers forsvinner budskapet i 8 ruter om skader.

### Kampanjer og landingssider

| Kampanje | Målgruppe | Krok | Tilbud | Sidens oppbygging | CTA | Når |
|---|---|---|---|---|---|---|
| **A. Varmtvannstank** `/varmtvannstank/sjekk/` | Huseiere 35+ i Aurskog-Høland og Lillestrøm | «Hvor gammel er tanken din? Sjekk på 10 sekunder.» | Fastpris på arbeidet ved bytte, pris uten befaring fra bilde | 1) Tanksjekk øverst 2) Resultat → «Send bilde av typeskiltet» 3) Fastpris, med/ikke med 4) Vannstopper som tillegg 5) Om Eirik kort 6) Skjema | «Send bilde av typeskiltet» + Ring | Hele året. Ekstra jan–mars (kulde, mye varmtvann) og aug–sep |
| **B. Hytta** `/hytte/vinterstengning/` og `/hytte/apning/` | Hytteeiere med hytte i Setskog, Rømskog, Hemnes, Aurskog | «Steng hytta riktig før frosten – du trenger ikke være der.» | Plass på rute-dag for ditt område. Samme pris neste år etter første besøk. | 1) Påmelding øverst (hytte, gnr/bnr, brønn ja/nei, nøkkel) 2) Hva som gjøres 3) Bilder og beskjed etterpå 4) Pris 5) FAQ | «Meld på hytta» | Høst: annonser 20. aug–15. okt. Vår: 15. mars–15. mai |
| **C. Boligkjøp og -salg** `/rorsjekk/` | Nye kjøpere, selgere før takst | «Fikk du TG2 på vann eller avløp? Få en rørlegger til å se på det.» | Rørsjekk til fast pris, skriftlig liste, opplasting i Boligmappa | 1) Hva sjekkes 2) Eksempel på liste 3) Pris 4) Typiske funn (tank, stoppekran, vannstopper) 5) Skjema | «Bestill rørsjekk» | Vår og høst (salgssesong). Pluss partnerskap med lokale meglere og takstmenn |
| **D. Lekkasjesikring** `/lekkasjesikring/` | Huseiere og borettslagsbeboere | «De vanligste vannskadene starter ved tanken og oppvaskmaskinen.» | Fast pris på vannstopper per type. Henvis til egen forsikring for rabatt; ikke lov rabatt. | 1) Hva en vannstopper gjør 2) Hvor den trengs 3) Pris 4) «Sjekk vilkårene i forsikringen din» 5) Skjema | «Send bilde av der den skal stå» | Hele året. Gjerne sammen med kampanje A |
| **E. Brønn** `/bronn-og-vann/brønnservice/` | Husstander og gårder med privat brønn | «Når tok du sist vannprøve? Når byttet du UV-lampa?» | Brønnservice til fast grunnpris + påminnelse hvert år (samtykke) | 1) Sjekkliste for brønnen 2) Hva servicen inneholder 3) Pris 4) Vannprøve-råd 5) Skjema | «Bestill brønnservice» | Vår (april–juni) og høst (sep–okt) |
| **F. Borettslag og sameier** `/borettslag/` | Styreledere og forretningsførere i Lillestrøm | «Én rørleggerdag for hele borettslaget.» | Fast pris per standardjobb, styret bestiller, beboerne booker | 1) Hvordan dagen fungerer 2) Prisliste 3) Dokumentasjon til styret 4) Kontakt | «Send forespørsel fra styret» | Jan–mars (før årsmøter). Selges direkte, ikke via annonser |

### Felles regler for landingssidene

- **Én jobb, ett skjema,** jobben forhåndsvalgt. Ingen meny-ruter som drar kunden bort, men logo og telefon øverst.
- **`?kilde=` på alle annonser** (`?kilde=meta-tank-2027-02`). Det passer med «ingen sporing»: tell innsendinger per kilde på serveren. Ikke legg inn Meta-piksel eller Google-tagg uten samtykkebanner. Bruk heller samtalesporing i Google Ads (ringeknapp i annonsen) og egne tall fra skjemaet.
- **Påminnelser og nyhetsbrev krever eget samtykke,** ikke forhåndsavkrysset. Samtykke til svar på WhatsApp er ikke samtykke til markedsføring.
- **Ærlighet:** «Nytt firma i 2027» kan stå rett ut. Selg på én person, fast pris og dokumentasjon, ikke på erfaring firmaet ikke har.
- **Ingen tidsløfter** i annonsene. «Pris før start» og «du trenger ikke være der» er sterke nok.

### Hva forsiden bør gjøre annerledes

1. **To dører i stedet for én:** «Noe er galt nå» og «Unngå at det skjer». Begge like synlige.
2. **Sesongkortet** gjør forsiden aktuell uten nytt innhold hver måned.
3. **Forsiden lenker til landingssidene** (tanksjekk, hytte, rørsjekk), så organisk trafikk også ser vedlikeholdstilbudene.
4. **Kortere:** fjern servicebil og bånd, slå sammen tank og tanksjekk, flytt skjemaet opp.

---

## 7. Wedge: ett skarpt inngangstilbud

Eieren ber om én wedge: et smalt tilbud som vinner de første kundene raskt og åpner døra til resten.

### Kandidatene

Poeng 1–5, der 5 er best for Kobber og Kran. For konkurranse betyr 5 lite konkurranse. Poengene er skjønn, ikke målte tall.

| Kriterium | 1. Smart vannsikkerhet (vannstopper, sensorer, fjernstenging) | 2. Årlig vannservice / abonnement | 3. Hytte: stengning og åpning | 4. Varmtvannstank til fastpris | **5. Lekkasjesikker hytte (1 + 3)** |
|---|---|---|---|---|---|
| Etterspørsel i området | 3 | 2 | 4 | 4 | 4 |
| Billettstørrelse | 3 | 2 | 2 | 5 | 3–4 |
| Gjentakende inntekt | 2 | 5 | 5 | 1 | 4 |
| Lett å selge på nett med fastpris | 4 | 3 | 4 | 5 | 4 |
| Forsikrings- og regelutløsere | 5 | 3 | 4 | 5 | 5 |
| Lite konkurranse fra etablerte | 3 | 5 | 4 | 2 | 5 |
| Passer for én person | 4 | 5 | 5 | 4 | 5 |
| **Sum** | **24** | **25** | **28** | **26** | **30–31** |

Kort om hver:

1. **Smart vannsikkerhet alene** er troverdig, men bredt. Elektrikere og nettbutikker selger det samme utstyret, og uten en konkret situasjon blir det et produkt på jakt etter et problem.
2. **Årlig vannservice** er det beste *beholdningsproduktet*, men et svakt *inngangsprodukt*. Få kjøper abonnement fra en ukjent rørlegger uten anmeldelser. Bruk det som steg to.
3. **Hytte** har lokal etterspørsel og gjentar seg hvert år, og store firmaer i Lillestrøm kjører sjelden langt inn i skogen for en time. Svakheten er lav billett og to korte topper i året.
4. **Varmtvannstank** gir mest per jobb og er lett å selge, men mange rørleggere og landsdekkende aktører har fastpris. Kunden trenger det én gang hvert 15.–20. år. Behold det som kjernetilbud, men det er ikke en wedge.
5. **Lekkasjesikker hytte** bruker hytta som inngang (riktig sted, riktig utløser, lite konkurranse) og løfter billetten med vannstopper og fjernstenging. Hytteeieren er borte, frykter frost og vannskade, og mange hytter har strøm og nett i dag.

### Anbefaling: «Lekkasjesikker hytte»

**Posisjon:** *Rørleggeren som gjør hytta klar og lekkasjesikker – du trenger ikke være der.*

Hvorfor den er skarp nok:
- **Én målgruppe:** hytteeiere med hytte i Setskog, Rømskog, Hemnes og Aurskog, som bor i Oslo eller Lillestrøm.
- **Én utløser:** sesongen. Planlagt oppstart mars–april 2027 treffer *åpningen* rett ved lansering.
- **Ett tilbud:** åpning (eller stengning) + vannstopper montert og testet, fast pris på arbeidet.
- **Lett å forklare:** «Får du varsel om lekkasje på mobilen, kan du stenge vannet på hytta hjemmefra.»

### Tilbud og prismodell (plassholdere)

| Pakke | Innhold | Prismodell |
|---|---|---|
| **Hytteåpning / vinterstengning** | Som på hyttesiden i dag, med bilder og beskjed etterpå | Timepris første gang, deretter fast pris per hytte: `[PRIS-ÅPNING]` |
| **Lekkasjesikker hytte** | Vannstopper på hovedledningen, lekkasjesensor ved tank og kjøkken, test, hjelp med appen, FDV | Fast pris på arbeid `[PRIS-ARBEID]` + utstyr etter valg (2–3 alternativer: uten nett, med app, med fjernstenging) |
| **Hytteavtale** (fra år 2) | Stengning + åpning + test av vannstopper og sensorer, påminnelse begge ganger | Fast pris per år `[PRIS-AVTALE]`, fakturert per besøk. Påminnelser bare med samtykke. |

Ikke skriv forsikringsrabatter som fakta. Skriv: «Sjekk vilkårene i forsikringen din. Noen selskaper gir rabatt eller stiller krav.»

### Hvem først

1. **Hytteeiere i Facebook-grupper og hyttevel** i Setskog og Rømskog, med lenke som har `?kilde=`.
2. **Folk Eirik og familien kjenner**, som kunder, ikke som anmeldere.
3. **Alle som melder seg på åpning:** tilbud om vannstopper i bekreftelsen og ved besøket.
4. Senere: **huseiere med gammel tank** (samme vannstopper, nå sammen med tankbytte).

### Plan for 30–60–90 dager

Dag 0 = lansering (mars–april 2027). Forarbeidet kan starte nå.

| Når | Gjør |
|---|---|
| **Før lansering** | Velg 2–3 produkter med grossisten (for eksempel Ahlsell, Brødrene Dahl eller Heidenreich): ett uten nett, ett med app, ett med fjernstenging. Monter og test på en hytte du kjenner, og ta bilder. Avklar hvilke som krever elektriker. Lag landingssiden. Opprett Google-profilen. |
| **Dag 1–30** | Landingssiden live. Venteliste for åpning per område, delt i 2–3 hyttegrupper. Mål: 10–15 åpninger. Tilby vannstopper i hver bekreftelse og ved hvert besøk. Anmeldelses-SMS til alle etter jobb. |
| **Dag 31–60** | Åpningene ferdige. Følg opp de som sa «kanskje». Legg ut ekte bilder i Google-profilen og gruppene. Mål andelen av åpningene som kjøpte vannstopper. Start husvarianten på tanksiden. |
| **Dag 61–90** | Sommer: monter vannstoppere mens eierne er på hytta. Åpne venteliste for vinterstengning (samtykke til påminnelse, tomt felt). Planlegg rute-dager per område for august–oktober. Bestem om hytteavtalen skal lanseres. |

Tall hver uke: påmeldinger per kilde, åpninger utført, andel med vannstopper, anmeldelser, påmeldte til høsten.

### Landingsside: `/hytte/lekkasjesikker/`

1. **Hero:** «Hytta klar og lekkasjesikker – du trenger ikke være der.» Knapper: «Meld på hytta» og Ring.
2. **Tre steg:** Eirik åpner (eller stenger) → monterer vannstopper → du får bilder og varsler på mobilen.
3. **Velg utstyr:** 2–3 kort (uten nett / med app / med fjernstenging) med fast pris på arbeid, og hva som krever strøm, nett eller elektriker.
4. **Hva det løser:** frost og lekkasje mens hytta står tom, og at du får vite det før naboen ringer.
5. **Forsikring:** én nøktern linje om å sjekke egne vilkår.
6. **Om Eirik:** foto, lokal, ny bedrift, dokumentasjon.
7. **Spørsmål og svar:** hytte uten strøm, uten mobildekning, med brønn, nøkkel, hva skjer når ventilen stenger.
8. **Kort skjema:** hytta (gnr/bnr eller «Bruk der jeg er nå»), brønn ja/nei, strøm og nett ja/nei, nøkkel, navn, telefon. Påminnelser: eget, tomt samtykkefelt.

### Slik åpner den døra til resten

- **Varmtvannstanken** på hytta: Eirik ser alderen og kan gi fastpris på bytte.
- **Brønn, pumpe og UV** på hytta: brønnservice hvert år.
- **Stoppekran og frostfri utekran:** vanlige funn ved åpning.
- **Hjemme:** hytteeieren har også et hus. Samme vannstopper der, gjerne sammen med tankbytte.
- **Hytteavtalen:** gjentakende inntekt fra år 2, og grunnlaget for årlig vannservice.

### Det som er usikkert

- **Elektriker:** fast tilkoblede ventiler (230 V) krever elektriker. Velg produkter med stikkontakt eller batteri, eller ha en fast elektrikerpartner.
- **Strøm og nett på hytta:** ikke alle hytter har det. Uten nett blir det stenging på stedet, ikke fjernstenging.
- **Produkt og støtte:** Eirik blir førstelinje for appen. Hold deg til få produkter og en grossist som tar reklamasjoner.
- **Krav og godkjenning:** avklar med bransjeforeningen om montering på eksisterende anlegg krever noe utover fagbrev og ansvarsforsikring. Ikke skriv godkjenninger som ikke finnes.
- **Forsikring:** krav og rabatter varierer og endres. Ikke lov noe.
- **Volum:** sjekk antall fritidsboliger i kommunen (SSB har tall) før det brukes penger på annonser.
- **Kapasitet:** åpning og stengning kommer i korte topper. Uten ventelister og rute-dager kan ikke én mann levere.

---

## 8. Gammelt utkast mot nytt: hva tar vi med?

Gammelt = grenen `demo/fullt-innhold` (enkelt oppsett, store illustrerte tjenestekort). Nytt = `design/kimkran-oppsett` (kimkran-stil med kobberrør, faktakort og tanksjekk).

| Element | Gammelt | Nytt | Behold hvilket / slå sammen slik | Hvorfor |
|---|---|---|---|---|
| **Hero-knapper** | **Ring først** (oransje), så skjema | Skjema først, Ring som flat knapp | **Gammelt:** Ring først, like stor som skjema. Legg til WhatsApp. | Eldre kunder på bygda ringer. |
| **Tre løfter** | Mørk stripe under hero | Borte fra visningen | **Ta med** som linje under knappene eller i faktakortet | Posisjonen i tre setninger, nesten uten plass. |
| **Faktakort med priser** | Fantes ikke | Timepris, tank, servicebil, kjøretid | **Nytt**, men bytt «kjøretid» med regneeksemplet | Priser øverst er sterkt. Kjøretid kan leses som oppmøtetid. |
| **Tjenestekort** | 5 kort med illustrasjon, kundens ord + fagord | 8 tekstruter, «Hva har skjedd?» | **Slå sammen:** kompakt nytt design, fagordet fra gammelt, og to dører («Noe er galt nå» / «Unngå at det skjer») | Gamle var tydelige men lange på mobil. Nye er kompakte men handler bare om skade. |
| **«Lekker det nå?»** | Egen seksjon rett etter tjenestene | Nederst ved skjemaet, lenke i menyen | **Gammel plassering, kortere:** stripe under hero som åpner listen | Den akutte kunden må finne den med en gang. |
| **Varmtvannstank** | 8 125 og 18 000 side om side, med/ikke med | Stort tall, illustrasjon, fakta, knapper | **Nytt**, men vis typisk total like tydelig som i gammelt | Kunden må se totalen, ikke bare arbeidet. |
| **Tanksjekk** | Fantes ikke | Måler med årstall | **Nytt.** Det beste elementet. Flytt inn i tankseksjonen. | Interaktiv krok for forebygging. |
| **Regneeksempel** | Egen blokk: tre priser + 1 875 kr | Ikke på forsiden | **Gammelt** inn i faktakortet: «En time med bil og forbruk: 1 875 kr + deler» | Svarer på «hva koster det å få deg hit?». |
| **Servicebilen** | Fantes ikke | Egen seksjon med utstyr og «bruk»-mål | **Fjern fra forsiden.** Kort versjon i Om Eirik når tallene er ekte. | Lav verdi for kunden, og tallene er oppdiktet. |
| **Bånd «På vei i Hemnes»** | Fantes ikke | Mørkt bildebånd | **Fjern**, eller bruk bildet i Om Eirik | En skjerm uten handling. |
| **Slik bestiller du** | Tre kort med ikoner | Tre nummererte kort | **Begge greie.** Kort det ned og legg det i skjemaseksjonen. | Forklarer prosessen der kunden bestemmer seg. |
| **Om Eirik** | Foto, tekst, dokumentasjon, godkjenninger, omtaler | **Mangler på forsiden** | **Gammelt, tilbake på forsiden.** Legg til «nytt firma fra 2027» og Boligmappa. | Ansikt og ansvar er den viktigste tilliten for en ny bedrift. |
| **Omtaler** | I Om Eirik, merket «Eksempel» | Ved Områder, merket «Eksempel» | **Skjult** til de er ekte, deretter rett over skjemaet | Ingen eksempler i produksjon. |
| **Områder** | Egen seksjon | Liste med base-merke | **Nytt**, men kompakt | Greit i begge. |
| **Header, desktop** | 5 menypunkter + Ring, WhatsApp, skjema | 7 punkter inkl. «Varmtvannstank» og «Lekker det?» + Ring | **Nytt menyinnhold, gamle knapper:** behold WhatsApp i toppen | «Lekker det?» i menyen er bra. WhatsApp forsvant. |
| **Header, mobil** | Logo + Meny | Logo + Meny | **Ingen av dem:** legg til ringeikon øverst, slik designet sa | Første trykk for den som scroller opp. |
| **Bunnlinje, mobil** | Ring · WhatsApp · Send forespørsel | Det samme | **Likt.** Gjør Ring og skjema like store. | – |
| **Lengde på mobil** | Lang på grunn av store illustrasjoner | Rundt 17 skjermer | **Begge for lange.** Mål: maks 8. | Skjemaet må komme tidligere. |
| **Visuell stil** | Rolig, vennlig, illustrasjoner | Kimkran-stil, kraftig typografi, kobberrør | **Nytt** (eierens valg), men bruk illustrasjonene fra gammelt på tjenestesidene | Det nye skiller seg mer ut; illustrasjonene gir varme. |

---

## Topp 10 endringer

Rangert etter forventet effekt i forhold til innsats. Wedgen (seksjon 7) og elementene fra det gamle utkastet (seksjon 8) er tatt med.

| # | Endring | Effekt | Innsats | Type |
|---|---|---|---|---|
| 1 | **Forkort forsiden til maks 8 mobilskjermer:** fjern servicebil og bånd, slå sammen tank og tanksjekk, skjemaet innen skjerm 7 | Høy | Lav | [nettside] |
| 2 | **Wedgen «Lekkasjesikker hytte»:** landingsside `/hytte/lekkasjesikker/` med påmelding per område, klar før vårens åpning 2027 | Høy | Middels | [nettside] [innhold] |
| 3 | **Google-profil (tjenesteområde) og fast anmeldelses-SMS** til alle kunder etter jobb | Høy | Lav | [utenfor nettsiden] |
| 4 | **Produktvalg og priser for vannstopper** med grossist og elektrikerpartner; test på én hytte og ta bilder | Høy | Middels | [utenfor nettsiden] |
| 5 | **Kort skjemavei:** steg 1 = hva + navn + telefon (+ «Ring meg»). Adressen flyttes til steg 2. | Høy | Middels | [nettside] |
| 6 | **Ta med fra gammelt utkast:** Ring først i hero, tre løfter, regneeksempel i faktakortet, Om Eirik tilbake på forsiden (ekte foto, «nytt firma fra 2027», Boligmappa) | Høy | Lav | [nettside] [innhold] |
| 7 | **To dører på forsiden:** «Noe er galt nå» / «Unngå at det skjer», med kundens ord + fagord, og sesongkort styrt av `aktivSesong` | Høy | Middels | [nettside] [innhold] |
| 8 | **Kontakt uten friksjon:** ringeikon i toppen på mobil, WhatsApp i hero og header, like store knapper i bunnlinjen, når Eirik tar telefonen, «Lekker det nå?» som stripe under hero, kjøretid omformulert til område | Middels | Lav | [nettside] [innhold] |
| 9 | **Fastprisjobber som følger wedgen:** vannstopper i hus, stoppekran, frostfri utekran, rørsjekk, og landingsside for tank med tanksjekken øverst | Middels–høy | Middels | [innhold] [nettside] |
| 10 | **Kanaler som gir jobber:** hyttevel og Facebook-grupper (venteliste), lokale meglere og takstmenn (rørsjekk), styrer i borettslag (rørleggerdag) | Middels–høy | Middels | [utenfor nettsiden] |

Før lansering uansett: skjul eksempelomtalene, bekreft eller fjern tallene i servicebilen, og sett ekte telefonnummer.
