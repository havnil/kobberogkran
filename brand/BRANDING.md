# Kobber og Kran – branding

Levert 11. november 2026. Logoene er bygget på eierens egne filer: kranen og røret er tracet direkte fra dem. Navnet i logo og markedsføring er **Kobber og Kran** (uten «AS»). «Kobber og Kran AS» brukes bare i juridisk tekst: bunntekst, faktura, vilkår og personvern.

Begge settene skal brukes:

- **Sett A** – røret går over navnet og ender i kranen. Hovedlogo der det er bredde: header på desktop, bil, skilt, sosiale delingsbilder.
- **Sett B** – kranen i oransje kvadrat ved siden av navnet. Brukes der det er trangt eller kvadratisk: mobilheader, favikon, profilbilder, caps og brystlogo.

## Mapper

| Mappe | Innhold |
| --- | --- |
| `logo/sett-a/` | Sett A som SVG: standard, på brun, på oransje, brun (én farge), hvit, og kranen alene |
| `logo/sett-b/` | Sett B som SVG: standard, på brun, på oransje, brun, stablet, stablet på brun |
| `logo/ikon/` | Kvadratisk ikon (oransje og brun) og `favicon.svg` |
| `logo/og-image.svg` | Kilde til delingsbildet |
| `png/` | PNG-eksporter med gjennomsiktig bakgrunn, favikon 32 px, `apple-touch-icon-180.png`, `ikon-512.png`, `og-image-1200x630.png` |
| `farger/` | `tokens.css` (klar til å flyttes inn) og `palett.json` |
| `fonter/` | Inter og Rubik som WOFF2, med lisens (SIL Open Font License 1.1) |
| `mockups/` | Logoark, bruk på bil, klær, visittkort og faktura, og kranvarianter |

All tekst i logo-SVG-ene er konvertert til konturer, så de ser riktige ut uten fonter installert.

## Farger

| Navn | Hex | Bruk |
| --- | --- | --- |
| Oransje | `#F26A0F` | Merket, flater, striper, knapper (med brun tekst) |
| Mørk oransje | `#A84508` | Oransje tekst og lenker på lys bunn |
| Lys oransje | `#F7883F` | Oransje tekst på brun bunn |
| Sjokoladebrun | `#4A2412` | All tekst, mørke flater, bunntekst |
| Dempet brun | `#6B4A38` | Sekundærtekst |
| Krem | `#F7F2EC` | Standard bakgrunn |
| Sand | `#EFE6DC` | Seksjoner og kort |

Oransje `#F26A0F` på hvitt er 3,1:1 og holder bare til stor tekst og grafikk. Brødtekst er alltid brun.

## Skrift

- **Inter** for alt på nettsiden: brødtekst 400–500, titler 800–900 med `letter-spacing: -0.02em`. Sett A-ordmerket er Inter Black.
- **Rubik ExtraBold** brukes bare i sett B-ordmerket og eventuelle store versaltitler i samme stil.

## Logoregler

- **Luft rundt logo:** minst høyden av kranens håndtak på alle sider.
- **Minste bredde:** sett A 160 px på skjerm og 40 mm på trykk. Sett B 140 px og 35 mm. Ikonet ned til 16 px.
- **Bakgrunn:** på oransje bunn brukes `-paa-oransje`-versjonene. På brun eller mørke bilder brukes `-paa-brun` eller `-hvit`.
- **Ikke** strekk, roter, legg skygge på eller bytt farger i logoen. Ikke skriv «AS» i logoen.

## Til agenten som bygger nettsiden

1. Kopier fontfilene fra `fonter/` til `public/fonts/` (stiene i `tokens.css` forutsetter det).
2. Flytt verdiene i `farger/tokens.css` inn i `src/styles/tokens.css`.
3. Bruk `png/favicon-32.png` og `logo/ikon/favicon.svg` som favikon. Bruk `png/apple-touch-icon-180.png` som Apple touch icon og `png/og-image-1200x630.png` som `og:image`.
4. **Header:** sett A på desktop (≥ 900 px) og sett B liggende på mobil. **Bunntekst:** `kobber-og-kran-a-paa-brun.svg` på brun bunn.
5. **Layoutforslag:** følg forsiden i designfila (Claude-artefakten «Kobber og Kran – branding», tavla «Nettside – forside»), inspirert av kimkran.no:
   - Øverst en stripe om døgnvakt.
   - Hovedfelt: «Rørlegger på Hemnes og i Aurskog-Høland» med knappene «Ring» og «Få pris».
   - En faktastripe og åtte nummererte tjenestekort. Hver tjeneste får sin egen side.
   - Prisguide, steds-chips (én side per sted), bestilling i tre steg og skjema med forhåndsvalgt tjeneste.
   - Lenke til kjedens produktkatalog og bunntekst.
6. Telefonnummer, priser, org.nr. og kjedenavn er ikke bestemt. Bruk tydelige plassholdere og ikke finn på tall.
