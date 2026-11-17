# kimkran.no – analyse, og hva Kobber og Kran må tilpasse

Dato: 12. november 2026. Kilde: kimkran.no slik den sto denne dagen (HTML for 9 sider + 5 ekstra hentet med curl,
`skjema.js`, `krok.js`, `sporing.js`, `robots.txt`, `sitemap.xml`), og målinger i nettleser på 375 px og 1440 px.

Dokumentet beskriver og parafraserer. Korte sitater er merket. All ordlyd i del 2 er **arbeidstitler**. Endelig tekst
skrives eller godkjennes av et menneske (se `CLAUDE.md`).

---

# Del 1 – Slik er kimkran.no bygget

## 1.1 Kort om siden

| | |
| --- | --- |
| Firma | Kim Johannesen AS («Kim Kran»), kran og transport, base på Lillehammer, 17 ansatte |
| Leverandør | Synlig Bedrift (står i bunnteksten og i personvernerklæringen som databehandler) |
| Antall sider i sitemap | 35 (+ personvern, som ikke står i sitemap) |
| Tema | Lyst tema (HTML-kommentar: valgt 14.10.2026). Mørkt tema ligger fortsatt i CSS-en |
| Fonter | Titillium Web (400/600/700/700i/900) og JetBrains Mono (500/700), selvhostet WOFF2 |
| Farger (lyst tema) | Bakgrunn `#f3f5f9`, panel hvit, tekst `#12141c`, grå `#5c6373`, aksent cyan `#0094cc`, gul `#e0a800`. Bunntekst og «band» er mørke (`#0b0c10`) |

## 1.2 Informasjonsarkitektur

### Sidetyper og URL-mønster

Alle URL-er er flate, med skråstrek på slutten. Ingen mapper som `/tjenester/` eller `/omrader/`.

| Sidetype | Antall | URL-mønster | Eksempel |
| --- | --- | --- | --- |
| Forside | 1 | `/` | |
| Tjenesteside | 17 | `/<tjeneste>/` | `/kranbil/`, `/snorydding-av-tak/`, `/elektrisk-mobilkran/` |
| Stedsside | 12 | `/kranbil-<sted>/` | `/kranbil-hamar/`, `/kranbil-oyer/` |
| Pris | 1 | `/pris/` | Gjelder bare kranbil |
| Kalkulator/guide | 1 | `/hvilken-kran/` | Kalkulator + forklarende tekst |
| Kontakt | 1 | `/kontakt/` | Tre «avdelinger» |
| Om oss | 1 | `/om-oss/` | |
| Kranspill | 1 | `/kranspill/` | 3D-spill (three.js) med toppliste og premier |
| Personvern | 1 | `/personvern/` | Ikke i sitemap |
| 404 | – | alle ukjente stier | Gir status 404, men viser en rest fra designfasen: «Denne undersiden er ikke bygget ennå» med lenke «Tilbake til versjonene» |

Stedssidene bruker alltid `kranbil-` i URL-en, også når innholdet mest handler om mobilkran (Hamar). Det er et
bevisst søkeordvalg: «kranbil + sted».

### Menyen

Header er `position: fixed`, 72 px høy, halvgjennomsiktig hvit med blur. Innhold: logo (venstre), 7 menypunkter,
ringeknapp (cyan, «Ring 477 55 600») og en «Meny»-knapp som bare vises under 1000 px.

| Menypunkt | På forsiden | På undersider |
| --- | --- | --- |
| Tjenester | anker `#tjenester` | `/#tjenester` (tilbake til forsiden, midt i siden) |
| Flåten | anker `#grid` | `/#grid` |
| Pris | `/pris/` | `/pris/` |
| Hvilken kran? | `/hvilken-kran/` | `/hvilken-kran/` |
| Elektrisk | anker `#elektrisk` (blokk på forsiden) | `/elektrisk-mobilkran/` (egen side) |
| Områder | anker `#omrader` | `/#omrader` |
| Kontakt | `/kontakt/` | `/kontakt/` |

Fire av sju punkter er ankre på forsiden. «Elektrisk» peker til to forskjellige mål avhengig av hvor du står. Det
finnes ingen undermeny, så ingen enkelt tjeneste eller sted kan nås fra menyen. «Om oss» står bare i bunnteksten.

**Mobil (< 1000 px):** menyen skjules og «Meny» (tekstknapp, `aria-expanded`) åpner et fullskjermspanel under headeren
med de samme 7 lenkene i 1,3 rem hvit tekst. **Ringeknappen i headeren skjules også** (`.topp .knapp{display:none}`), og
menyen har ingen telefonlenke. Panelet lukkes når en lenke trykkes. Ingen Escape-håndtering, ingen fokusfelle.

### Bunntekst (lik på alle sider)

Mørk bunn, tre kolonner (én kolonne under 1000 px):

1. Logo (hvit/blå) og én setning om hva firmaet gjør.
2. «Kontakt»: telefon, e-post (Cloudflare-tilslørt, krever JS), Facebook.
3. «Adresse»: besøksadresse og postboks.
4. Bunnlinje i monospace: `© 2026 Kim Johannesen AS · Org.nr. … · Om oss · Kontakt · Personvern · Nettside: Synlig Bedrift`.

Ingen lenker til tjenester eller steder i bunnteksten. Org.nr. står uten «MVA» (MVA-nummeret finnes bare i JSON-LD).

### Hvordan sidene lenker til hverandre

```
Forside ──16 kort──▶ tjenestesider ──4 kort «Andre tjenester»──▶ andre tjenestesider
   │                       │
   ├──12 lenker──▶ stedssider ◀──12 «chips» «Her kjører vi»── alle undersider
   ├──▶ /pris/  ◀── tjenestesider (lenke i tekst), kontakt (kort)
   ├──▶ /hvilken-kran/ ◀── tjenestesider og FAQ («kalkulatoren»), /pris/
   └──▶ /kranspill/ ──▶ /hvilken-kran/#foresporsel
```

Hver underside har samme bunnblokker: «Andre tjenester» (4 kort), «Her kjører vi» (12 steder) og skjemaet. Det gir
mange interne lenker (bra for SEO), men sidene blir svært like.

## 1.3 Forsiden, seksjon for seksjon

Mål (lest i nettleser): **13 625 px høy på 375 px bredde (ca. 17 skjermhøyder)**, skjemaet starter på ca. 11 180 px.
**8 049 px på 1440 px** (ca. 9 skjermhøyder), skjemaet på ca. 6 530 px.

Felles overskriftsmønster («hode»): en liten **eyebrow** i JetBrains Mono, versaler, sperret (`letter-spacing .14em`),
cyan; så en **stor tittel** i Titillium 900, versaler, skråstilt med `transform: skewX(-8deg)` (klassen `skra`),
`clamp(2.4rem, 5.4vw, 4.6rem)`; og til høyre en kort grå ingress (maks 44 tegn bred). Under 1000 px stables alt.
Seksjoner har 120 px luft (84 px på mobil). Elementer med klassen `vis` glir inn fra venstre når de kommer i bildet
(IntersectionObserver), slått av ved «redusert bevegelse». Knapper er parallellogrammer (`clip-path`), versaler,
sperret.

| # | Seksjon | Formål | Innhold og CTA | Visuelt | Mobil |
| --- | --- | --- | --- | --- | --- |
| 1 | **Hero** | Si hva og hvor, få kontakt | «Nyhet»-chip (gul) som lenker til elektrisk-blokken; eyebrow «Kim Kran · Lillehammer · Innlandet»; H1 «Kranbil og mobilkran i *Innlandet*» (stedsnavnet i cyan); slagord + kapasitet i én setning; to knapper: «Få pris på løftet» (cyan, til `#foresporsel`) og «Ring 477 55 600» (mørk) | Fullskjerm bakgrunnsfoto (CSS-bakgrunn, zoomer sakte inn), lys gradient fra venstre. Til høyre en **«tele»-boks** (nøkkeltall): 2×2 tall (250 t, 90 m, 50–95 t/m, 9 kraner) og «5,0 ★★★★★ 23 på Google». Boksen henger i en tegnet kjetting med krankrok og løftes raskere enn siden når du scroller (`krok.js`) | Én kolonne, gradient ovenfra. Tele-boksen havner under knappene (110 px luft for kjettingen). Ingen ringeknapp i header – heroens «Ring»-knapp er den eneste |
| 2 | **#tjenester** | Vise bredden | Eyebrow «16 tjenester», H2 «Hva skal løftes?», ingress om kundetyper. **16 kort** nummerert 01–16, hvert med navn (versal kursiv), én setning og «Se mer →». Ett kort har gult merke «Spesialitet» | Rutenett 4×4 med 2 px skillelinjer, cyan strek glir inn under kortet ved hover | 2 kolonner under 1000 px, **1 kolonne under 620 px: ca. 3 600 px lang** |
| 3 | **#grid «Flåten»** | Vise kapasitet/troverdighet | Eyebrow «Maskinpark», tabell med 7 rader: nr., maskintype + undertekst, antall som små cyan «streker» (animeres inn), kapasitet i monospace høyrejustert. Elektrisk mobilkran i gult | Tabell med linjer, første nr. i cyan parallellogram | Antall-strekene flyttes til egen rad |
| 4 | **#elektrisk** | Nyhet / differensiering, forhåndssalg | Bilde av kranen (`<picture>` med webp-srcset, lazy), stort gult tall «150 tonn», H2, avsnitt, 4 nøkkeltall (`dl`), knapper «Book elektrisk mobilkran» (forhåndsvelger tjenesten i skjemaet via `data-velg`) og «Les mer» | Boks med gul venstrekant og gul radial glød | Én kolonne, bildet over |
| 5 | **#kalkulator** | Hjelpe kunden å velge, skape engasjement, samle data til skjemaet | Eyebrow «Kran-kalkulator», H2 «Hvilken kran trenger du?», lenker til guiden og kranspillet. To store tallfelt (vekt, avstand), knapp «Bruk i forespørselen». Til høyre en halvsirkel-måler (SVG) 0–150 t/m med grense ved 95 (kranbil→mobilkran), stort tall, tekstsvar (`role="status"`) og forbeholdet «Veiledende · ikke grunnlag for løfteplan» | Store tall i Titillium 900, måleren blir gul over grensen | Felt over måler |
| 6 | **Band** | Stemning, lokal tilhørighet | Bare eyebrow (adresse) og H2 «Ute i distriktet hver dag» på et stort foto | 70vh, fast bakgrunn (parallakse) på desktop, mørk gradient | Bakgrunnen scroller vanlig |
| 7 | **«Slik bestiller du»** | Senke terskelen | Eyebrow, H2, ingress («ingen mellomledd»), **3 steg**: Forespørsel → Riktig bil (pris) → Løftet | Tre paneler med farget toppkant (cyan, gul, grønn), «Steg 1» i mono | Stables |
| 8 | **#omrader + anmeldelser** | Lokal SEO, sosialt bevis | Venstre: H2 «Hele Innlandet» og **12 stedslenker** i to kolonner (Lillehammer merket «BASE»). Høyre: «5,0» stort, stjerner, «23 anmeldelser», 3 korte sitater med fornavn | Lister med linjer, hover skyver teksten | Én kolonne |
| 9 | **#foresporsel** | Konvertere | Venstre: eyebrow, H2 «Få pris på løftet», ingress, **stort telefonnummer** i cyan kursiv, e-post og adresse. Høyre: skjemaet (se 1.5) | Hvitt panel med cyan toppkant, felt-etiketter i mono versaler | Én kolonne, 24 px padding |

Monospace brukes konsekvent til «metadata»: eyebrows, nummerering (01–16), etiketter (`dt`), skjemaetiketter,
brødsmuler, «Sist oppdatert», bunnlinjen. Store tall bruker `font-variant-numeric: tabular-nums`.

## 1.4 Mal for tjenesteside og stedsside

Begge bruker **samme mal**. Rekkefølge:

| # | Blokk | Tjenesteside (f.eks. `/kranbil/`) | Stedsside (f.eks. `/kranbil-hamar/`) |
| --- | --- | --- | --- |
| 1 | Hero (`hero side`, 78vh) | Brødsmuler «Kim Kran / Tjenester / Kranbil». H1 «Tjeneste i Lillehammer og *Innlandet*». Ingress. «Få pris på kranbil» + «Ring» | Brødsmuler «… / Områder / Hamar og Stange». H1 «Tjeneste i *Sted*». Ingress med lokal vinkel |
| 2 | Tele-boks | «Spesifikasjoner»: antall biler, kapasitet, utstyr | «Fra basen»: kapasitet + **avstand fra basen** («ca. 60 km») |
| 3 | Artikkel + sideboks (2 kolonner: tekst / 320 px) | 6–10 H2-er: hva det er, typiske jobber, private jobber, utstyr, faguttrykk forklart, X eller Y, før vi kommer, vinterføre, «Hva koster …?», slik bestiller du. 1–2 Google-sitater som `blockquote` | 5–8 H2-er med lokalt innhold: hvem som bygger der, lokale utfordringer (trange gater, hytteveier, sesong), prisfaktorer pga. avstand |
| 3b | Sideboks («Raskeste vei»), `sticky` på desktop | Stort telefonnummer, én setning, 3 fakta (kranbiler, mobilkraner, base), «Send forespørsel» | Identisk |
| 4 | FAQ «Det folk lurer på» | 3–5 `<details>`, **speilet i FAQPage JSON-LD** | 3–5 lokale spørsmål |
| 5 | «Sist oppdatert {dato}» | | |
| 6 | 4 tjenestekort | «Henger sammen med / Andre tjenester» | «Dette gjør vi i {sted}» |
| 7 | 12 sted-chips | «Her kjører vi» | «Andre steder vi kjører», gjeldende sted med `aria-current` |
| 8 | Skjema | Eyebrow «Forespørsel · Kranbil», tjenesten **forhåndsvalgt** i nedtrekkslisten | Eyebrow «Forespørsel · Hamar og Stange», **stedsfeltet forhåndsutfylt** («Hamar») |

**SEO-mønsteret er tydelig og gjennomført:**

- `<title>` = søkeord + sted + «| Kim Kran», varierer rekkefølgen («Kranbil på Hafjell og i Øyer – hytteløft»).
- `meta description` med tall og telefonnummer.
- Egen `canonical`, OG-tittel/-beskrivelse lik title/description, `og:locale nb_NO`.
- JSON-LD `@graph` per side: `WebPage` (med `dateModified`), `Service` (med `areaServed`), `LocalBusiness` (`@id` `#firma`),
  `BreadcrumbList` og `FAQPage`.
- Synlig «Sist oppdatert», FAQ i tekst, mye intern lenking, stedsnavn i H1.
- Lokalt innhold er skrevet for hvert sted, ikke bare byttet navn. Men blokkene rundt (sideboks, kort, chips,
  skjema, hero-bilde) er identiske.

**Hva som varierer:** H1, ingress, tele-tall, artikkelteksten, FAQ, valg av 4 kort, forhåndsvalg i skjemaet.
**Hva som er likt:** hero-bildet (nesten alle undersider bruker samme foto, `kimkran-flaten`), sideboks, chips, skjema,
bunntekst. Undersidene har **ingen egne bilder i innholdet** (0 `<img>` i `main` på alle fem kontrollerte sider).

### De andre sidetypene

| Side | Struktur | Merknad |
| --- | --- | --- |
| `/pris/` | Mal som over. Hero sier timepris eks. og inkl. mva. Tele: timepris, inkl. mva, «timer fra avreise», minimum 2–3 t. Artikkel: hva du betaler for (5 deler av en jobb), **regneeksempel** (et løft på en halvtime blir 3 timer → beløp eks. og inkl. mva), minimum, prosjektpris for bedrift | Den mest konkrete og tillitvekkende siden. Gjelder bare kranbil |
| `/hvilken-kran/` | Hero → kalkulatoren (samme komponent som forsiden) → guide (tonnmeter forklart med tabell for 50/85/95 t/m, teori vs. virkelighet, tommelfingerregler for vekt) → FAQ → kort → skjema med egen overskrift «Send vekt og avstand» | SEO-side for «hvor mye kan en kran løfte» |
| `/kontakt/` | Hero uten tele-boks → **3 avdelingskort** (Kranbil / Mobilkran / Transport), hvert med kontaktperson, samme telefon, egen e-post og knapp som forhåndsvelger tjenesten → kort tekst om hvem du skal kontakte + adresse/org.nr. → kort → skjema | Alle tre har samme telefonnummer |
| `/om-oss/` | Hero med tele (stiftet, ansatte, erfaring, kraner) → artikkel (ingen mellomledd, slagordet, folkene, flåten som liste, kundetyper, utstyr) → FAQ → kort → skjema | Overskriften «Fra arkivet» står **tom** (innhold mangler) |
| `/kranspill/` | Egen, enklere stil og header (logo + «KimKran Games» + telefon). 3D-kranbil (three.js r128 fra cdnjs), styres med knapper/tastatur, poeng, **toppliste** (kvartal/år/alltid) med premie, forklaring av tonnmeter og CTA til `/hvilken-kran/#foresporsel` | Morsomt og delbart, men lagrer navn og valgfri e-post (beskrevet i personvern) |
| `/personvern/` | Mal uten tele. 9 korte H2-er: ansvarlig, hva samles inn, formål, «hvor du kom fra», kranspillet, informasjonskapsler, lagring (e-post + Cloudflare-database i Europa, Synlig Bedrift som databehandler), sletting etter 12 mnd, rettigheter/Datatilsynet | Klart og kort. God modell |

## 1.5 JavaScript i detalj

Tre felles skript, alle `defer`, lastes på hver side: `sporing.js`, `skjema.js`, `krok.js`. I tillegg Cloudflares
e-posttilsløring (`email-decode.min.js`). Ingen rammeverk.

### `skjema.js` – skjema, kalkulator, meny og inn-animasjon

**Felter i HTML** (alle sider): Navn*, Telefon* (`type=tel`), E-post (valgfritt), «Hva gjelder det?» (nedtrekk med
alle tjenester + «Annet»), «Hvor skal det løftes / jobben gjøres?», Vekt ca., Avstand, Når? (fritekst «Dato / uke»),
«Beskriv jobben» (tekstfelt), og et skjult honningfelt `nettside`. * = `required`.

**Satt inn av skriptet:**

1. **Bedrift/privat.** Øverst i skjemaet settes det inn en `fieldset` «Hvem er du?» med to radioknapper stilt som
   segmentknapp. **Bedrift er forhåndsvalgt** (kommentar i koden: de fleste kranoppdrag kommer fra bedrifter). Når bedrift
   er valgt vises tre felter: «Bedrift (skriv navn eller org.nr.)», «Org.nr.» og «Fakturaadresse», og etiketten «Navn»
   byttes til «Kontaktperson». Velger du privat, skjules blokken.
2. **Oppslag i Brønnøysundregistrene.** Bedriftsfeltet er en ARIA-`combobox`. Etter 220 ms pause søkes det i det åpne
   API-et (9 sifre = direkte oppslag, ellers navnesøk, 6 treff). Valg fyller firmanavn (pent formatert), org.nr. og
   adresse. Piltaster, Enter og Escape virker; utdaterte svar forkastes.
   ```js
   var url = /^\d{9}$/.test(rent) ? BRREG + '/' + rent : BRREG + '?size=6&navn=' + encodeURIComponent(q);
   ```
3. **Adresseforslag (Kartverket).** Stedsfeltet blir også en combobox. Fra 3 tegn (250 ms pause) spørres
   adresse-API-et og stedsnavn-API-et parallelt, pluss et ekstra søk med `*` når det er tall i teksten (fanger halve
   ord). Har kunden skrevet husnummer, kommer adresser først, ellers stedsnavn. **Treff i Innlandet (fylkesnr. 34)
   prioriteres**, maks 7. Fritekst er fortsatt lov («hytta på Hafjell»). Valgt forslag lagrer koordinater i skjulte felt
   `sted_lat`/`sted_lon` – serveren bruker dem til å regne kjøretid fra basen.
4. **«Bruk der jeg er nå».** En lenkeknapp under stedsfeltet (bare hvis nettleseren har geolokasjon). Spør om posisjon
   **først når kunden trykker**, med høy nøyaktighet (15 s tidsavbrudd), gjør omvendt oppslag mot nærmeste adresse
   innen 300 m, og fyller feltet. Finnes ingen adresse, skrives koordinatene. GPS-punktet sendes som lat/lon. Ved avslag:
   «Fikk ikke lov – skriv adressen» i 4 sekunder.

**Validering:** bare nettleserens egen (`required`, `type=email`). Ingen egne feilmeldinger per felt.

**Innsending:** `fetch` POST som JSON til `/api/foresporsel` (kommentar: «Pages Function → Cloudflare Email Service»).
Skriptet legger til kildedata:
```js
Object.assign(data, kilde, forste, { side: location.pathname });
```
– `kilde`: `gclid`, `sokeord`, `treff`, `kampanje` fra URL (Google Ads), lagret i `sessionStorage`.
– `forste`: landingsside, ekstern referrer, UTM-koder for økta (`sessionStorage`).
– `side`: siden skjemaet ble sendt fra (e-posten viser hvilken underside forespørselen kom fra).

**Tilbakemelding:** knappen blir «Sender …» og deaktiveres. Ved `{ok:true}` nullstilles skjemaet og en grønn
statuslinje (`role="status"`) viser takk + at de tar kontakt «så fort vi kan» – **ingen tidsløfte**. En krok-ikon glir
opp (CSS-animasjonen `heis`). Ved feil: serverens feilmelding + oppfordring om å ringe; ved nettverksfeil: «Fikk ikke
sendt. Ring oss …». Telefonnummeret står i alle feilmeldinger.

**Spam:** bare honningfeltet `nettside` (flyttet ut av skjermen, `tabindex=-1`). Ingen Turnstile/CAPTCHA på klientsiden.
Hva serveren sjekker, ser vi ikke.

**Kalkulatoren:** `behov = vekt × avstand × 1,5` (margin for krok, åk og at kranen taper kapasitet). Over 25 m: «blir ofte
mobilkran». Ellers: holder det med en kranbil (≤ 95 t/m), eller «over det en kranbil tar». Måleren fylles med
`stroke-dashoffset`, blir gul over grensen. «Bruk i forespørselen» kopierer vekt/avstand til skjemaet, scroller dit og
setter fokus i navnefeltet etter 500 ms.

**Annet:** `[data-velg]`-lenker forhåndsvelger tjeneste i skjemaet. Mobilmenyen (klasse `meny-apen` på `body`). Inn-glid
(`.vis` → `.inn`). Hendelser (`kk:skjema-startet`, `kk:skjema-sendt`, `kalkulert`, `kk:firma-valgt`) sendes til
`sporing.js` – skjemaet vet ikke om sporing finnes.

### `krok.js` – kranen som scroll-element

1. **Hero:** har heroen en tele-boks, tegnes en SVG-«slynge» (to kjettinger fra hjørnene opp til en blå løkke, med
   logoens krok hektet i). Boksen løftes når du scroller, raskere enn siden (faktor 0,7 desktop / 0,45 mobil), slått av
   ved redusert bevegelse. Uten tele-boks henger en svingende krok i en vaier som senkes ved scroll.
2. **Krok-skinnen** (`a.krok-skinne`): en fast vaier langs høyre kant med kroken nederst. Vaierlengden følger hvor langt
   ned i siden du er (`--p` = scroll-andel). Hover viser «Få pris». Klikk går til `#foresporsel` (eller `/#foresporsel`
   hvis siden mangler skjema). **Vises bare fra 1380 px bredde** – altså aldri på mobil, nettbrett eller vanlige
   bærbare.
   ```js
   var p = maks > 0 ? Math.min(scrollY / maks, 1) : 0;
   skinne.style.setProperty('--p', p.toFixed(4));
   ```

### `sporing.js` – hva som spores

| Del | Hva | Til hvem | Samtykke |
| --- | --- | --- | --- |
| Google-tagg (GA4 + Ads) | Hendelser: `telefon_klikk`, `epost_klikk`, `skjema_startet`, `skjema_sendt`, `generate_lead`, `kalkulator_brukt`, `tjeneste_klikk`, `omrade_klikk`, `krok_klikk`, `pris_klikk`, `scroll_75` m.fl., med «plassering» (header, hero, sideboks, skjema, footer …) | Google | Consent Mode v2, alt «denied» til «Godta». **ID-ene er tomme i dag**, så taggen lastes ikke og banneret vises ikke |
| Samtykkebanner | «Godta» / «Bare nødvendige», valget i `localStorage`, lenke i bunnteksten for å ombestemme seg | – | – |
| Egen besøkstelling | `sendBeacon` til `/api/besok` ved **hver sidevisning**: sti, ekstern referrer, UTM, om det var Google Ads-klikk | Egen server (Cloudflare D1, vises i et eget admin-panel) | Ingen spørsmål. Ingen informasjonskapsler, men bruker `sessionStorage` |
| Telefon-/e-postklikk | Samme beacon med type, nummer, plassering og lenketekst (sendes i capture-fase, før mobilen bytter til telefonappen) | Egen server | Ingen |

Merk: siden sier «ingen informasjonskapsler», og det stemmer. Men lagring i `sessionStorage`/`localStorage` som ikke er
strengt nødvendig kan også kreve samtykke etter ekomloven (§ 2-7b). Det er en juridisk vurdering, ikke noe vi skal kopiere.

## 1.6 Konverteringsflyt

**Mål:** (A) ringe, (B) sende forespørsel.

| Fra | Til ring | Til sendt forespørsel |
| --- | --- | --- |
| Forside, desktop ≥ 1000 px | 1 trykk (header-knappen, alltid synlig) | 1 trykk «Få pris» (hero, header-skinne ≥ 1380 px) → fyll navn + telefon → «Send» (min. 4 handlinger). Bedriftsfeltene er valgfrie |
| Forside, mobil | 1 trykk **bare mens heroen er synlig**. Etter det: scroll tilbake til toppen eller ned til skjemaseksjonen (~11 000 px) eller bunnteksten. Menyen har ikke telefonnummer | 1 trykk «Få pris på løftet» i hero → hopper ca. 11 000 px. Ellers lang scroll |
| Tjenesteside/stedsside, desktop | Header + stort nummer i sticky sideboks | Hero-knapp eller sideboks → skjema med tjeneste/sted forhåndsvalgt |
| Tjeneste/sted, mobil | Hero-knapp; sideboksen blir statisk etter artikkelen | Hero-knapp → skjema nederst |
| Kalkulator | – | «Bruk i forespørselen» → skjema med vekt/avstand utfylt og fokus i navn (sterk bro) |
| Kontakt | Telefon i hvert avdelingskort | «Send til X» forhåndsvelger tjeneste |
| Kranspill | Telefon i header og CTA-boks | «Få pris på løftet» → `/hvilken-kran/#foresporsel` |

**Alltid synlig:** på desktop header med ringeknapp (og krok-skinnen på brede skjermer). **På mobil er ingenting
handlingsrettet alltid synlig** – bare logo og «Meny».

Hver side har sitt eget skjema nederst, så kunden forlater aldri siden for å sende. Det er et godt grep.

## 1.7 Teknisk og SEO

| Område | Funn |
| --- | --- |
| Byggemåte | Håndskrevne/genererte statiske HTML-filer, ikke et kjent rammeverk. Delte filer under `/felles/` med cache-nøkkel `?v=<hash>`. **All CSS (ca. 35 kB) ligger inline i hver side** (`<style id="v3">`), så den caches ikke mellom sider. Hver side er ca. 50–56 kB HTML |
| Plattform | Cloudflare (Pages Functions for `/api/foresporsel`, `/api/besok`, `/api/kranspill`; D1-database; Email Service; e-posttilsløring). `robots.txt` stenger `/admin/` og `/api/`. `www` gir 301 til apex. HSTS, `nosniff`, `referrer-policy` |
| Meta | Unik title/description/canonical per side. `og:title`, `og:description`, `og:image`; `og:locale` bare på undersider. Mangler `og:type`, `og:url`, Twitter-kort. `theme-color` hvit |
| JSON-LD | Forsiden: `LocalBusiness` + `additionalType HomeAndConstructionBusiness`, `@id`, `name`, `legalName`, `url`, `logo`, `image`, `telephone`, `email`, `vatID`, `address`, `geo`, `areaServed` (12 steder), `sameAs` (Facebook, Brreg). Undersider: `@graph` med `WebPage`, `Service`, `LocalBusiness`, `BreadcrumbList`, `FAQPage`. Kranspill: `VideoGame`. Mangler: `openingHours`. Undersider viser til `#nettsted` (`WebSite`) som ikke er definert noe sted |
| Bilder | Bare 3 ekte foto på hele siden (to av egen bil, ett fra Liebherr med kreditering). Hero er CSS-bakgrunn med `image-set()` (webp + jpg), mindre variant under 900 px, og `<link rel=preload … imagesrcset … fetchpriority=high>` for LCP. Elektrisk-bildet er `<picture>` med webp-srcset, `width/height`, `loading=lazy`. Hero-bildet har `role="img"` + `aria-label` (ikke et ekte `<img>`, så ikke synlig for bildesøk) |
| Fonter | Selvhostet WOFF2, `font-display: swap`, `unicode-range` (latin), preload av Titillium 400 og 900. 7 `@font-face` |
| Ytelse | Ingen tredjepartsskript i dag (Google-tagg av). Tre små `defer`-skript. Svak side: inline-CSS × 35 sider, og ubrukt mørkt tema + temabryter-CSS følger med |
| Tilgjengelighet – bra | `lang="nb"`, landemerker (`header`, `nav`, `main`, `footer`, `aside` med `aria-label`), brødsmuler som `nav aria-label`, `aria-current` på chips og meny, ARIA-combobox med tastatur på oppslag, `role="status"` på skjema/kalkulator, `prefers-reduced-motion` respektert, `aria-label` på ringeknappen, dekor med `aria-hidden` |
| Tilgjengelighet – svakt | Ingen «hopp til innhold»-lenke. Menyknappen mangler `aria-controls`, Escape og fokusstyring. Små (0,62–0,74 rem) versale monospace-etiketter overalt. **Cyan `#0094cc` som tekst på lys bunn er ca. 3,2–3,4:1** (under 4,5:1 for liten tekst) – brukes på eyebrows og lenker. Skjemaetiketter er små grå mono-versaler. Plassholdere brukes som hjelpetekst. E-post krever JS (Cloudflare-tilsløring) |
| Sitemap/robots | `sitemap.xml` med 35 URL-er (personvern mangler). `robots.txt` tillater alt utenom admin/api |
| 404 | Riktig status, men feil innhold (rest fra «velg forsideversjon»-fasen) |

## 1.8 Styrker og svakheter

### Styrker (verdt å ta med)

1. **Tydelige CTA-er overalt:** «Få pris» + «Ring» i hver hero, stort telefonnummer i sideboks og ved skjema.
2. **Skjema på hver side**, forhåndsutfylt med tjeneste eller sted fra siden du står på.
3. **Smart skjemahjelp:** adresseforslag fra Kartverket, «bruk der jeg er nå», Brreg-oppslag. Mindre skriving for kunden,
   bedre data for firmaet (koordinater → kjøretid).
4. **Åpen pris med regneeksempel** (timepris eks./inkl. mva, hva timene består av, minimum).
5. **Sterk lokal SEO-struktur:** én side per tjeneste og per sted, unik tekst, FAQ i tekst og JSON-LD, brødsmuler, «sist
   oppdatert», mye intern lenking.
6. **«Slik bestiller du» i tre steg** – enkel forventningsavklaring.
7. **Rask og lett:** statisk, ingen tredjepartsskript som standard, preload av hero og fonter.
8. **Personvern i klarspråk**, og samtykkemodell som ikke laster Google før «Godta».
9. **Gjenkjennelig visuell identitet:** krankroken fra logoen går igjen i ikoner, kulepunkter og animasjoner.

### Svakheter – og hvorfor eieren synes den er «litt vanskelig å finne frem på»

| # | Problem | Konkret |
| --- | --- | --- |
| 1 | **16 likestilte tjenester** | Alle kort er like store, nummerert 01–16 (antyder en rekkefølge som ikke betyr noe), sortert etter flåte, ikke etter hva kunden leter etter. Private og bedrifter, små og store jobber blandes. På mobil er listen ca. 3 600 px lang |
| 2 | **Menyen blander ankre og sider** | 4 av 7 punkter er ankre på forsiden. Fra en underside sender «Tjenester» deg midt ned på forsiden, ikke til en tjenesteoversikt. «Elektrisk» betyr to forskjellige mål. Ingen undermeny for tjenester eller steder. «Om oss» finnes ikke i menyen |
| 3 | **Lang forside** | Ca. 17 mobilskjermer og 9 desktopskjermer. Skjemaet ligger etter 9 seksjoner |
| 4 | **Flere innganger til samme behov** | «Pris» (timepris kranbil), «Hvilken kran?» (kalkulator), kalkulatoren på forsiden, kranspillet og alle «Få pris»-knapper (som er skjemaet). Ordet «pris» betyr tre ting |
| 5 | **Ingen kontaktknapp på mobil etter hero** | Ringeknappen skjules i header under 1000 px, menyen har ikke nummeret, krok-skinnen vises bare ≥ 1380 px |
| 6 | **Undersidene ser like ut** | Samme hero-bilde, samme sideboks, samme 12 chips, samme skjema. Det er vanskelig å se at man har byttet side |
| 7 | **Fagspråk og små etiketter** | Tonnmeter, jibb, lastdiagram; mono-versaler på 0,6–0,7 rem |
| 8 | **Skjemaet starter med bedriftsfelter** | Bedrift er forhåndsvalgt, så en privatperson møter firmasøk, org.nr. og fakturaadresse før navnet |
| 9 | **Kontakt deler i tre avdelinger** | Tre kort med samme telefonnummer – valg uten reell forskjell |
| 10 | **Rester** | Tom «Fra arkivet», 404 som viser til «versjonene», mørkt tema i CSS-en |

---

# Del 2 – Hva vi må tilpasse for Kobber og Kran

## 2.1 Utgangspunkt

Kobber og Kran er det motsatte av Kim Kran på nesten alle akser som påvirker nettsiden:

| | Kim Kran | Kobber og Kran |
| --- | --- | --- |
| Størrelse | 17 ansatte, 9 kraner | Én rørlegger (Eirik), oppstart ca. mars/april 2027 |
| Kunder | Mest bedrifter | 75 % private (service, bad, hytte, brønn), resten næring/borettslag/underentreprise |
| Tjenester | 16 likestilte | 5 i prioritert rekkefølge, flere senere |
| Bevis | 5,0 på Google, 23 anmeldelser, flåte, bilder | Ingenting ennå – alt bevis er plassholdere |
| Hast | Planlagte løft | Ofte akutt (lekkasje, tett avløp, frost på hytta) |
| Område | Hele Innlandet, 12 steder | Aurskog-Høland + Lillestrøm, 7 steder |
| Sporing | Egen telling + Google klargjort | Ingen sporing i starten |
| Teknikk | Statisk HTML på Cloudflare Pages | Astro 7 på Cloudflare Workers, nb + en, Sveltia CMS |

Prinsipp fra eieren: **behold oppsettet og flyten, men gjør det lettere å finne fram.**

## 2.2 Behold / Tilpass / Dropp – element for element

### Struktur og navigasjon

| Element på kimkran.no | Vurdering | Hvordan / hvorfor |
| --- | --- | --- |
| Flat URL-struktur, én side per tjeneste | **Behold** | `src/content/pages/nb/<slug>.md`. Korte, ord-baserte slugger uten æøå |
| Stedssider `/kranbil-<sted>/` | **Tilpass** | `/rorlegger-<sted>/`. Start med de stedene vi faktisk har noe å si om (Hemnes, Bjørkelangen, Aurskog, Lillestrøm). Tynne sider med bare byttet stedsnavn kan Google se som «doorway»-sider. Hver side må ha ekte lokal tekst (skrevet av menneske) |
| Meny med blandede ankre | **Tilpass** | Bare ekte sider i menyen: Tjenester, Priser, Områder, Om Eirik, Kontakt. «Tjenester» får en enkel undermeny/nedtrekk med de 5 tjenestene. Ingen ankre i hovedmenyen |
| Ringeknapp i header | **Tilpass** | Synlig på **alle** bredder (ikon + nummer, eller bare ikon under ~400 px). Telefonnummer også øverst i mobilmenyen |
| Mobilmeny | **Tilpass** | Legg til `aria-controls`, Escape for å lukke, fokus til første lenke, sperr scroll bak |
| Krok-skinnen (fast «Få pris» til høyre, ≥ 1380 px) | **Tilpass** | Erstattes av en **fast bunnlinje på mobil** med «Ring» og «Få pris» (to like store knapper). På desktop holder header-knappene. Ikke kopier vaier/scroll-animasjonen |
| Brødsmuler | **Behold** | Med `BreadcrumbList` i JSON-LD. Siste ledd peker til ekte sider (ikke `/#tjenester`) |
| Bunntekst | **Tilpass** | Legg til det loven og forretningsplanen krever på hver side: **Kobber og Kran AS, adresse, e-post, telefon, org.nr. + MVA**. Legg til lenker til de 5 tjenestene og områdesiden. Personvern-lenke. Sjekk om «Foretaksregisteret» skal stå ved org.nr. (foretaksregisterloven § 10-2). Logo `kobber-og-kran-a-paa-brun.svg` på brun bunn (BRANDING.md) |
| Egen 404 per språk | **Behold** (har vi allerede) | Ikke gjør feilen med en rest-side |

### Forsiden

| Seksjon på kimkran.no | Vurdering | For Kobber og Kran |
| --- | --- | --- |
| «Nyhet»-chip i hero (elektrisk kran) | **Tilpass** | Bruk plassen til én viktig beskjed, f.eks. arbeidstittel «Oppstart våren 2027 – book nå». Fjernes når den ikke er sann lenger. Ikke døgnvakt (se 2.6) |
| Hero med H1 sted + to knapper | **Behold** | Arbeidstittel H1: «Rørlegger på Hemnes og i Aurskog-Høland». Knapper: «Få pris» (oransje, brun tekst) og «Ring». Bilde: Eirik/bil (plassholder til ekte foto finnes) |
| Tele-boks med nøkkeltall + Google-stjerner | **Tilpass** | Bytt kapasitetstall med **løfter vi kan holde**, f.eks. «Pris før start», «Fastpris på bereder», «Lokal på Hemnes». Google-stjerner **vises ikke** før ekte anmeldelser finnes. Ingen kjetting/løfte-animasjon |
| 16 tjenestekort | **Tilpass** | **5 kort**, i forretningsplanens rekkefølge, gjerne formulert som kundens problem (arbeidstitler: «Lekkasje, tett avløp, kran», «Ny varmtvannsbereder», «Brønn og vann», «Hytta», «Bad»). Nummerering 01–05 kan beholdes som visuelt grep. Fremtidige tjenester vises ikke som kort |
| Flåten (#grid) | **Dropp** | Én mann og én bil er ikke et salgsargument i tabellform. Erstattes av **«Priser i korte trekk»** (se under) og «Om Eirik» |
| Elektrisk mobilkran-blokken | **Dropp** som innhold, **behold formen** | Den store «nyhetsblokken» med bilde, stort tall og to knapper kan brukes til **fastpris på varmtvannsbereder** (vår mest produktiserte tjeneste): stort tall = fastpris inkl. mva, 3–4 fakta (hva som er med), knapper «Bestill bytte» (forhåndsvelger tjenesten) og «Les mer» |
| Kalkulator | **Tilpass** → «Priser i korte trekk» | En enkel pristabell (inkl. mva for private) + **ett regneeksempel** som på `/pris/` (f.eks. en kort servicejobb = 1 time + servicebil + forbruksmateriell, se 2.5). Et interaktivt «prisanslag» er fase 2 og må aldri se ut som et tilbud. Det grove prisanslaget fra AI-en går bare til Eirik |
| Band «Ute i distriktet hver dag» | **Tilpass** | Stemningsbilde fra bygda med arbeidstittel som «bygdas egen rørlegger». Uten parallakse (`background-attachment: fixed` er tungt på mobil) |
| «Slik bestiller du» – 3 steg | **Behold** | Tilpasset vår flyt: 1) Send bilde, adresse og hva det gjelder (eller ring) 2) Eirik ser på det og gir pris før start 3) Jobben gjøres til avtalt tid. Ingen svartidsløfte |
| Områder (12 lenker) + anmeldelser | **Tilpass** | 7 steder som chips. Anmeldelsesdelen erstattes av en **plassholder** som ikke publiseres før ekte omtaler finnes. Ingen oppdiktede sitater |
| Skjemaseksjon med stort telefonnummer | **Behold** | Se 2.4 |
| (mangler hos Kim Kran) **Godkjenninger og trygghet** | **Legg til** | Sentral godkjenning, våtromskompetanse, forsikring, kjede/grossist – alle som plassholdere som blokkerer lansering |
| (mangler) **Om Eirik**-teaser | **Legg til** | Bilde + to setninger + lenke. For en enmannsbedrift er personen beviset |

### Undersidene

| Element | Vurdering | Hvordan |
| --- | --- | --- |
| Felles mal for tjeneste- og stedsside | **Behold** | Én Astro-layout, innhold i Markdown med frontmatter (hero, fakta, FAQ, forhåndsvalg) så CMS-et kan redigere |
| Tele-boks per side | **Tilpass** | «Fakta»-boks med 3–4 punkter som faktisk gjelder tjenesten (f.eks. fastpris, typisk varighet, hva du må gjøre før) |
| Artikkel + sticky sideboks | **Behold** | Sideboks: telefon, «Få pris», 3 fakta om bedriften (lokal, pris før start, godkjenning) |
| FAQ med FAQPage JSON-LD | **Behold** | 3–5 spørsmål per side, skrevet av menneske |
| «Sist oppdatert» | **Behold** | Fra Git eller frontmatter |
| 4 kort «Andre tjenester» | **Tilpass** | Med bare 5 tjenester: vis de 2–3 som henger sammen (bereder ↔ service, bad ↔ service, brønn ↔ hytte) |
| 12 sted-chips på hver side | **Tilpass** | 7 chips, men bare på tjeneste- og stedssider, ikke på kontakt/om/personvern |
| Samme hero-bilde overalt | **Tilpass** | Eget bilde per tjeneste når ekte bilder finnes. Til da: en rolig farget hero uten foto er bedre enn samme foto overalt |
| `/pris/` | **Tilpass** → `/priser/` | Full prisliste (inkl. mva for private, eks. mva i egen kolonne/egen fane for bedrift), hva prisen består av, regneeksempel, fastpriser. Prisopplysning til forbrukere skal være inkl. mva |
| `/hvilken-kran/` | **Dropp** som eget verktøy | Den forklarende delen blir en del av `/priser/` («Hva koster rørlegger?») |
| `/kontakt/` med 3 avdelinger | **Tilpass** | Én person: Eirik, telefon, e-post, adresse, område, skjema. Ingen avdelinger |
| `/om-oss/` | **Tilpass** → «Om Eirik» | Hvem, hvorfor, godkjenninger, område, partnere for bad. Bilde |
| `/kranspill/` | **Dropp** | Morsomt for et kranfirma, men ikke vårt behov, og det samler personopplysninger |
| `/personvern/` | **Behold strukturen** | Samme korte oppsett, oppdatert for bildeopplasting, AI-behandling (hvilken leverandør, hvor) og «ingen sporing» |

### JavaScript

| Funksjon | Vurdering | Hvordan |
| --- | --- | --- |
| Skjema → JSON → server | **Tilpass** | Astro server-rute på Workers (`/api/foresporsel`), se 2.4 |
| Bedrift/privat + Brreg-oppslag | **Tilpass** | **Privat forhåndsvalgt** (75 % av kundene). Bedrift åpner Brreg-oppslaget – det er godt, behold det |
| Adresseforslag (Kartverket) | **Behold, tilpass filter** | Prioriter Aurskog-Høland (kommunenr. **3226**, inkluderer Rømskog) og Lillestrøm (**3205**), evt. hele Akershus (fylke **32**), i stedet for Innlandet (34) |
| «Bruk der jeg er nå» | **Behold** | Spør bare ved trykk, som i dag. Nyttig for «det lekker her og nå» |
| Kildedata (gclid, UTM, referrer) i `sessionStorage` | **Dropp** | «Ingen sporing i starten». Vi sender bare med hvilken side skjemaet ble sendt fra (del av selve forespørselen, nevnes i personvern) |
| `/api/besok`-beacon på hver side | **Dropp** | Samme grunn. Eventuell besøksstatistikk senere er en egen beslutning for eieren |
| Google-tagg + samtykkebanner | **Dropp** | Ingen banner trengs når ingenting lagres. Koden er en god mal hvis Ads kommer senere |
| `krok.js` (slynge, vaier, skinne) | **Dropp** | Erstattes av fast mobil bunnlinje (ren CSS, ingen JS) |
| Inn-glid ved scroll (`.vis`) | **Dropp eller sterkt dempe** | Innhold som er usynlig til JS kjører, gir flimring og risiko. Hvis noe, kun svak fade med `prefers-reduced-motion` |
| Cloudflare e-posttilsløring | **Eiers beslutning** | Er en sone-innstilling i Cloudflare (som agenter ikke rører). Uten JS vises «[email protected]». Vurder vanlig `mailto:` |

### Visuelt (oversatt til vår merkevare)

| Kim Kran | Kobber og Kran |
| --- | --- |
| Eyebrow i JetBrains Mono, cyan, versaler | **Behold mønsteret** (eyebrow + stor tittel + kort ingress), men eyebrow i Inter 600–700, `--color-orange-dark` `#A84508` (6:1 på hvitt), ikke mono. Ingen monospace-font i merkevaren |
| Tittel Titillium 900, versal, skråstilt | Inter 800–900, `letter-spacing: -0.02em`, ikke skrå. Rubik ExtraBold kun der BRANDING.md tillater |
| Parallellogram-knapper | Pille-knapper (`--radius-button: 999px`), oransje `#F26A0F` med **brun tekst** |
| Skarpe kort med 2 px linjer | Kort med `--radius-card: 18px`, sand `#EFE6DC` på krem `#F7F2EC` |
| Cyan lenker (3,2–3,4:1) | `#A84508` for lenker og liten oransje tekst. Oransje `#F26A0F` bare på store elementer og flater |
| Mørk bunntekst og mørkt «band» | Brun `#4A2412` bunntekst, lys oransje `#F7883F` for aksent på brun |
| Krok som gjennomgående ikon | Kran-ikonet fra logoen kan brukes som kulepunkt og i kvittering – én gang, ikke animert |
| Nummerering 01–16 | 01–05 på tjenestekort, i Inter med tabulære tall |

## 2.3 Forslag til sidestruktur (sitemap)

Arbeidstitler. Engelske slugger er forslag; alle sider skal finnes på begge språk (regel i `CLAUDE.md`), engelsk tekst
skrives av menneske.

```
/                                   Forside
/tjenester/                         Oversikt (5 tjenester, kort tekst om hver + «kommer senere»-linje)
  /service-og-reparasjon/           Lekkasje, tett avløp, kraner, toalett, ventiler       (01)
  /varmtvannsbereder/               Bytte av bereder, fastpris                             (02)
  /bronn-og-vannbehandling/         Brønnpumpe, trykktank, filter, UV                      (03)
  /hytte/                           Vinterstengning, åpning, frostskader                   (04)
  /bad/                             Rørleggerdelen, med partnere                           (05)
/priser/                            Prisliste inkl. mva, hva prisen består av, eksempel, fastpriser
/omrader/                           Oversikt + kart/liste over 7 steder
  /rorlegger-hemnes/                (base)
  /rorlegger-bjorkelangen/
  /rorlegger-aurskog/
  /rorlegger-lillestrom/
  (/rorlegger-loken/, /rorlegger-setskog/, /rorlegger-romskog/ – når det finnes lokal tekst)
/om/                                Om Eirik og Kobber og Kran AS
/kontakt/                           Telefon, e-post, adresse, skjema
/personvern/
/en/…                               Samme struktur (f.eks. /en/services/, /en/prices/, /en/about/)
```

**Senere** (fra forretningsplanen, ikke ved lansering): `/varmepumpe-og-vannbaaren-varme/`, `/spredt-avlop/`,
`/for-byggmestre/` (underentreprise), `/dognvakt/`, og eventuelt egen side for næring/borettslag.

Totalt ved lansering: ca. 15–18 sider per språk, mot 36 hos Kim Kran.

### Meny

| Desktop | Mobil (meny åpnet) | Alltid synlig |
| --- | --- | --- |
| Logo (sett A) · Tjenester ▾ · Priser · Områder · Om Eirik · Kontakt · **[Ring]** · **[Få pris]** · NB/EN | Telefonnummer øverst · Tjenester (5 lenker utfoldet) · Priser · Områder · Om Eirik · Kontakt · språkvelger | Mobil: logo (sett B) + ringeikon + «Meny» i toppen, og **fast bunnlinje «Ring» / «Få pris»** |

## 2.4 Forsidens seksjonsrekkefølge for Kobber og Kran

Mål: **maks ca. 7–8 mobilskjermer** (Kim Kran: ca. 17), skjemaet innen ca. 5 skjermer.

| # | Seksjon (arbeidstittel) | Erstatter hos Kim Kran | Innhold | CTA |
| --- | --- | --- | --- | --- |
| 1 | Header | Header | Logo, meny, Ring, Få pris | Ring / Få pris |
| 2 | Hero «Rørlegger på Hemnes og i Aurskog-Høland» | Hero | Eyebrow (sted), H1, én setning om posisjon («bygdas egen rørlegger»), faktaboks med 3 løfter vi kan holde, valgfri nyhetschip om oppstart | Få pris · Ring |
| 3 | «Hva trenger du hjelp med?» – 5 kort | 16 tjenester | 01–05, kort tekst, lenke til tjenesteside | Kortene |
| 4 | «Fastpris på varmtvannsbereder» | Elektrisk mobilkran-blokken | Stort tall (plassholder til bekreftet), hva som er med / ikke med | Bestill bytte (forhåndsvelger) · Les mer |
| 5 | «Priser i korte trekk» | Flåten + kalkulator | 4–5 linjer prisliste inkl. mva + ett regneeksempel + lenke til `/priser/` | Se alle priser |
| 6 | «Slik bestiller du» – 3 steg | Samme | Bilde/adresse → pris før start → avtalt tid | Få pris |
| 7 | «Bygdas egen rørlegger» – Om Eirik + godkjenninger | Band + om oss | Foto, 2–3 setninger, godkjenningsmerker (plassholdere) | Les om Eirik |
| 8 | Områder (+ anmeldelser når de finnes) | Områder + Google | 7 sted-chips. Anmeldelser: plassholder, skjult til ekte | Stedssider |
| 9 | Skjema «Få pris» | Forespørsel | Se 2.5 | Send |
| 10 | Bunntekst | Bunntekst | Juridisk info, kontakt, tjenester, områder, personvern | – |

## 2.5 Skjemaet og AI-sorteringen

Beslutning (b) fra eieren: bilde + adresse + hva det gjelder; fast, godkjent automatisk kvittering uten tidsløfte; AI
sorterer og sender sammendrag **bare til Eirik**; AI skriver aldri fritt til kunden.

### Felter (rekkefølge)

| Felt | Type | Påkrevd | Kommentar |
| --- | --- | --- | --- |
| Hva gjelder det? | Store valgknapper (5 tjenester + «Annet») | Ja | Forhåndsvalgt fra siden kunden står på (som Kim Kran) |
| Haster det? | Valg: «Det lekker nå» / «Snart» / «Kan planlegges» | Nei | Velges «lekker nå»: vis telefonknappen tydelig over send-knappen. Ingen løfte om utrykning før døgnvakt finnes |
| Hvor? | Adresse med Kartverket-forslag + «Bruk der jeg er nå» | Ja | Koordinater i skjulte felt → avstand fra Hemnes regnes på serveren |
| Bilde | Filopplasting, flere bilder, kamera på mobil | Nei (anbefalt) | Komprimer i nettleseren, fjern EXIF (posisjon i bilder), maks antall og størrelse. Lagres i R2 med kort levetid |
| Beskriv | Tekstfelt | Nei | |
| Navn, Telefon | Tekst / tel | Ja | |
| E-post | email | Ja hvis kvittering sendes på e-post | Alternativt kvittering på SMS senere |
| Privat / bedrift | Segmentknapp, **Privat forhåndsvalgt** | – | Bedrift åpner Brreg-oppslag (behold fra Kim Kran) |
| Honningfelt + Cloudflare Turnstile | Skjult | – | Kim Kran har bare honningfelt. Turnstile er allerede planlagt i grunnmur-specen |

Validering per felt med synlig feiltekst ved feltet (ikke bare nettleserens egen), `aria-describedby`, og fokus til
første feil.

### Flyt på serveren (Astro-rute på Workers)

1. Valider og avvis spam (honningfelt, Turnstile).
2. Lagre forespørsel og bilder (D1 + R2, Europa), med slettefrist som i personvernerklæringen.
3. Send **fast kvittering** til kunden – en mal godkjent av eier, uten tidspunkt, med kopi av det kunden sendte.
4. Kjør AI-sortering: hast, jobbtype, avstand/kjøretid fra Hemnes, grovt prisanslag, manglende opplysninger.
5. Send sammendrag + original + bilder **bare til Eirik**.
6. Statusmelding på siden: fast tekst (som Kim Kran: takk + vi tar kontakt), **ingen tidsløfte**.

Feilmeldinger skal alltid inneholde telefonnummeret (godt grep fra Kim Kran).

Dette er første del av «AI-kontoret» (d). Datamodellen bør derfor lagre forespørselen strukturert (jobbtype, sted,
koordinater, hast, status) så tapte anrop, tilbud og oppfølging kan bygge på samme data senere.

### Priser (fra forretningsplanen, startforslag – må bekreftes av eier før publisering)

| Post | Eks. mva | Inkl. mva |
| --- | --- | --- |
| Timepris | 900 | 1 125 |
| Kveld/helg per time | 1 800 | 2 250 |
| Servicebil per oppdrag | 500 | 625 |
| Forbruksmateriell | 100 | 125 |
| Utrykning kveld/natt/helg, første time | 2 900 | 3 625 |
| Fastpris bytte bereder 200 l (arbeid) | 6 500 | 8 125 |
| Rørleggerarbeid bad 4–5 m² | 55 000 | 68 750 |

Regneeksempel-mal (som Kim Kran sitt «en halvtime blir 3 timer»): 1 time + servicebil + forbruksmateriell =
1 125 + 625 + 125 = **1 875 kr inkl. mva**, pluss deler. Forbrukere ser inkl. mva først. «Utrykning» vises ikke før
døgnvakt tilbys.

## 2.6 Plassholdere som blokkerer lansering

Beslutning (c): ekte innhold finnes ikke ennå. Kim Kran sin troverdighet hviler på ting vi ikke har (anmeldelser,
flåte, bilder). Vi skal **ikke** fylle hullene med oppdiktet innhold.

| Plassholder | Hvor | Blokkerer |
| --- | --- | --- |
| Telefonnummer | Header, mobil bunnlinje, hero, sideboks, skjema, bunntekst, JSON-LD | Ja |
| Org.nr. + MVA, forretningsadresse, e-post | Bunntekst, kontakt, personvern, JSON-LD | Ja |
| Godkjenninger (sentral godkjenning, våtrom), forsikring | Forside, om, bad-siden | Ja |
| Bilder (Eirik, bil, jobber) | Hero, om, tjenestesider | Nei for lansering, men hero uten foto må se ferdig ut |
| Anmeldelser | Forside, tjenestesider | Nei – seksjonen skjules til de finnes |
| Bekreftede priser | Priser, forside, bereder-blokk | Ja |
| Kjedenavn / produktkatalog (nevnt i BRANDING.md) | Bunntekst/forside | Avklares |
| All tekst i begge språk | Alle sider | Ja (menneske skriver/godkjenner) |

Teknisk forslag: firmadata (telefon, org.nr. osv.) ligger **ett sted** (en konfig- eller CMS-fil), brukes av både
sider og JSON-LD, og plassholdere har et fast merke (f.eks. `PLASSHOLDER`). En sjekk etter bygg (utvidelse av
`check:dist`) kan feile når merket finnes i en produksjonsbygg ment for lansering. Det er en teknisk endring som må
planlegges sammen med eier, siden `scripts/` og CI berøres.

**Merk om døgnvakt:** BRANDING.md foreslår en stripe om døgnvakt øverst på forsiden, men forretningsplanen sier døgnvakt
kommer senere. En slik stripe ved lansering vil love noe vi ikke leverer. Anbefaling: dropp stripen til døgnvakt er
bestemt, eller bruk den til oppstartsbeskjeden.

## 2.7 Teknisk og SEO for Kobber og Kran

| Kim Kran | Vi |
| --- | --- |
| 35 kB inline CSS på hver side | Astro samler CSS i hashede filer som caches (standard) |
| JSON-LD håndskrevet per side, `#nettsted` mangler | Genereres fra firmadata. `WebSite` + `LocalBusiness` (type `Plumber`) med `@id`, `address`, `geo`, `areaServed` (7 steder), `telephone`, `email`, `vatID`, `openingHours` når det er bestemt, `sameAs` (Brreg). Per side `WebPage`, `Service`, `BreadcrumbList`, `FAQPage`. Ingen `aggregateRating` før ekte data |
| `og:locale` bare på undersider, mangler `og:type/url` | Alle OG-felter på alle sider, `og:image` = `brand/png/og-image-1200x630.png`, `og:locale` nb_NO / en_GB + `og:locale:alternate` |
| Ingen `hreflang` (ett språk) | `hreflang` nb/en/x-default (finnes allerede i `src/i18n/`) |
| Hero som CSS-bakgrunn | Ekte `<img>`/`<picture>` via Astro `<Image>` med `srcset`, `fetchpriority="high"` på hero, alt-tekst skrevet av menneske |
| Preload av 2 fontvekter | Preload av Inter 400 og 800/900, `font-display: swap`, bare de vektene vi bruker |
| Ingen hopp-lenke, cyan 3,2:1 | Hopp-lenke (finnes allerede i ui.ts), kontrast etter `brand/farger/tokens.css` (brun tekst, mørk oransje lenker) |
| Personvern ikke i sitemap | Alle offentlige sider i sitemap |
| 404 = rest | Egen 404 per språk med lenker til tjenester og telefon |

## 2.8 Slik løser vi «vanskelig å finne frem»

| Problem hos Kim Kran | Vårt grep |
| --- | --- |
| 16 likestilte tjenester | 5 tjenester, prioritert, formulert som kundens problem. Fremtidige tjenester skjult |
| Meny med ankre | Bare ekte sider, «Tjenester» med undermeny, «Om Eirik» i menyen |
| 17 mobilskjermer | Mål ≤ 8. Én seksjon per spørsmål kunden har: hva, hva koster, hvordan, hvem, hvor, send |
| «Pris» betyr tre ting | «Priser» = prislisten. «Få pris» = skjemaet. Ingen kalkulator ved lansering |
| Ingen kontakt på mobil etter hero | Fast bunnlinje Ring / Få pris, telefon i header og meny |
| Like undersider | Sideboks og chips beholdes, men egne bilder/fakta per tjeneste, færre gjentatte blokker |
| Bedriftsfelter først i skjemaet | Privat forhåndsvalgt, «Hva gjelder det?» først |
| Fagspråk, små mono-etiketter | Hverdagsspråk (skrives av menneske), etiketter i normal størrelse og normal skrift |
| Tre avdelinger på kontakt | Én person, ett nummer |

---

## Topp 10 tilpasninger

1. **5 tjenester i stedet for 16**, prioritert og formulert som kundens problem, med egen side hver.
2. **Meny med bare ekte sider** (Tjenester med undermeny, Priser, Områder, Om Eirik, Kontakt) – ingen ankre.
3. **Ring og Få pris alltid synlig på mobil** (fast bunnlinje + ringeikon i header). Kim Kran skjuler ringeknappen under 1000 px.
4. **Kortere forside** (mål ≤ 8 mobilskjermer mot ca. 17), skjemaet tidligere.
5. **Flåten og kalkulatoren erstattes av «Priser i korte trekk»** med prisliste inkl. mva og ett regneeksempel. Elektrisk-blokken blir «fastpris på bereder».
6. **Skjema med «hva gjelder det» først, bilde, adresse med Kartverket-forslag (filter Aurskog-Høland/Lillestrøm) og «bruk der jeg er nå»**. Privat forhåndsvalgt, Brreg-oppslag for bedrift beholdes.
7. **Fast godkjent kvittering uten tidsløfte, AI-sammendrag bare til Eirik**, Turnstile i tillegg til honningfelt.
8. **Ingen sporing**: dropp `sporing.js`, kildefangst i `sessionStorage`, besøksbeacon og samtykkebanner.
9. **Tydelige plassholdere som blokkerer lansering** (telefon, org.nr. + MVA, adresse, godkjenninger, priser) – ingen oppdiktede anmeldelser, tall eller døgnvakt-løfter.
10. **Merkevaren erstatter Kim Kran-stilen**: behold mønsteret eyebrow + stor tittel + nummererte kort + 3 steg, men i Inter, krem/sand/brun/oransje, runde former, uten monospace, skråstilling og kran-animasjoner. Kontrast etter `tokens.css`.
