# Forslag til leverandører: telefoni, meldinger og AI

Dato: 2026-11-13. Gjelder oppgave 10. **Eieren velger.** Ingen ekte integrasjon i oppgave 11 og 12 før valget er tatt.
Alt her er hentet fra leverandørenes egne sider der det var mulig. Det som ikke er bekreftet, er merket **(ubekreftet)**.
Priser er eks. mva. i USD/EUR slik leverandøren oppgir dem. Regn grovt 10–11 kr per USD/EUR (antakelse). Prisene endres, så sjekk dem på kjøpsdagen.

## 1. Kort anbefaling

**Anbefalt: Telnyx for nummer, telefon og SMS. WhatsApp direkte på Meta Cloud API hvis eieren får til coexistence på eget oppsett, ellers via Telnyx. Claude Haiku 5.5 til sortering. Cloudflare e-post til Eirik.**

- Ett norsk nummer (fra ca. 1 USD/mnd), videresending til Eiriks mobil og webhook ved ubesvart anrop (`no-answer`). Ingen månedsavgift utenom nummeret.
- Koden støtter Meta Cloud API direkte (`X-Hub-Signature-256`, `hub.challenge`). Telnyx sender WhatsApp-hendelser i eget format og med egen signatur, så via Telnyx må vi skrive en adapter (liten jobb).

**Alternativ: 46elks (nummer, SMS, videresending, svensk selskap) + 360dialog (WhatsApp, coexistence).**
- Dyrere fast: nummer 11 EUR/mnd og WhatsApp fra 49 EUR/mnd.
- Til gjengjeld enklere "alt i EU" og en WhatsApp-partner som er laget for coexistence.

### Anslått månedskostnad ved lav bruk
Forutsetning: 50 forespørsler, 40 tapte anrop, 100 utgående meldinger (de fleste WhatsApp, noen få SMS), ca. 150 min videresendt samtaletid.

| Post | Anbefalt (Telnyx) | Alternativ (46elks + 360dialog) |
| --- | --- | --- |
| Nummer | ca. 1 USD | 11 EUR |
| Videresending til norsk mobil (150 min) | **ukjent**: Norge-prisen står ikke på åpne sider. Gjetning 0,05–0,15 USD/min = 8–23 USD **(ubekreftet)** | 0,236 EUR/min = ca. 35 EUR (oppgitt for "calls to Norway mobile") |
| WhatsApp-plattform | 0 (direkte Meta) eller 0,004 USD/melding via Telnyx = 0,4 USD | 49 EUR/mnd |
| WhatsApp-maler (Metas pris, ca. 90 stk) | ca. 0,017 USD hver = ca. 1,5 USD (se 3.2) | samme |
| SMS (ca. 10 stk) | ca. 0,07 USD hver = ca. 0,7 USD | 0,064 EUR hver = 0,64 EUR |
| AI (Haiku 5.5, 30–60 forespørsler) | under 0,05 USD | samme |
| E-post til Eirik | 0 | 0 |
| **Sum** | **ca. 12–27 USD (hovedsakelig videresending)** | **ca. 95–100 EUR** |

Videresendingen dominerer. Hvis Eirik får få samtaler gjennom nummeret, er Telnyx klart billigst. Be om Telnyx' prisliste for Norge før valget (se 4).

## 2. Hva koden krever

- Ut: `Kanal.send(tilE164, mal)` for `whatsapp`, `rcs`, `sms`, faste maler. Alt er `fetch`, ingen Node-SDK.
- Inn WhatsApp: Meta-webhook (`X-Hub-Signature-256`).
- Tapte anrop: generisk HMAC-verifisering og adaptergrensesnitt i `src/server/telefoni.ts`. Trenger norsk nummer, videresending til mobil, webhook ved ubesvart anrop og helst oppringers nummer.
- Varsel til Eirik: Cloudflare `send_email`.

## 3. Tabeller per kategori

### 3.1 Telefoni (norsk nummer, videresending, webhook ved ubesvart anrop)

| Kandidat | Pris | EU-lagring | Workers | Webhook ved ubesvart | Kilder |
| --- | --- | --- | --- | --- | --- |
| **Telnyx** | Norske lokalnummer (områdekoder 23, 32, 38, 56, 75) fra 1 USD/mnd. Voice API 0,002 USD/min pluss SIP-trunk-avgift (ikke oppgitt for Norge). SMS på nummer: 0,10 USD/mnd ekstra. Porting støttes (FastPort). | Ikke bekreftet **(ubekreftet)**. Telnyx har EU-regioner, men jeg fant ingen side som lover EU-lagring av anropsdata. | Ja, REST + webhooks | TeXML `<Dial>` har `action`-callback med `DialCallStatus` = `completed`/`busy`/`no-answer`/`canceled`/`failed`. Oppringers nummer kommer med som vanlig. Webhooks signeres av Telnyx (ikke samme HMAC som koden forventer, så en liten adapter trengs) **(ubekreftet om TeXML-action er signert)**. Norske nummer krever sannsynligvis identitets-/firmadokumentasjon **(ubekreftet)**. | [Norge](https://telnyx.com/phone-numbers/norway.md), [nummerpriser](https://telnyx.com/pricing/numbers), [Voice API-pris](https://telnyx.com/pricing/voice-api), [TeXML Dial](https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/dial), [call completed](https://developers.telnyx.com/api-reference/callbacks/texml-call-completed) |
| **46elks** | Nummer 11 EUR/mnd (virtuelt, hvilke typer er uklart). Samtale til norsk mobil 0,236 EUR/startet min. Videresending til SIP 0,01 EUR/min. | Ikke oppgitt på prissiden **(ubekreftet)**. Selskapet er svensk (EU/EØS). | Ja, enkel HTTP-API, webhooks per anrop | Anropsflyt styres av JSON fra egen webhook. Eget "ikke besvart"-hendelse **ikke verifisert** i denne runden **(ubekreftet)**. | [Priser](https://46elks.com/pricing) |
| **Twilio** | Internasjonale nummer fra 1,15 USD/mnd. Norge lokal/mobil må bestilles og krever identitetsdokumentasjon. Norge-prisen for lokalnummer og voice er ikke oppgitt på åpne sider. | Valg av region finnes, men ikke bekreftet for Norge-nummer **(ubekreftet)** | Ja | Ja, `<Dial>` action med `DialCallStatus`, samme modell som Telnyx (kjent fra Twilio, ikke åpnet i denne runden) **(ubekreftet)** | [SMS/priser Norge](https://twilio.com/sms/pricing/no), [regulatorisk](https://www.twilio.com/en-us/guidelines/no/regulatory), [porting](https://www.twilio.com/en-us/guidelines/no/porting) |
| **Telavox** (norsk/nordisk) | Kun tilbud, ingen åpen pris | EU (svensk) **(ubekreftet)** | Webhook finnes ("Personal webhooks") | Tapt anrop er en støttet trigger. Rettet mot bedriftsvekselen, ikke et API for ett lite nummer. | [Telavox webhooks](https://www.telavox.com/?p=25852) |
| Phonero, Telenor, Telia | Ikke undersøkt i dybden. Bedriftsabonnement med eget API for tapte anrop er ikke funnet. | Norge | Uklart | Ikke funnet **(ubekreftet)** | Telia har kun SMS-bulk/RBM-sider, se 3.3 |

Vurdering: Telnyx og Twilio har samme anropsmodell og passer koden best. Telnyx er billigst på nummer. Telavox er for tungt for dette.

### 3.2 WhatsApp

Metas prismodell: per levert melding siden 1. juli 2025. Meldinger fra kunde til bedrift er gratis. Fra 1. oktober 2026 koster også service-meldinger over 1000 gratis per nummer per måned, og utility-maler inne i 24-timersvinduet er ikke lenger gratis. Utility-maler sendt innenfor "free entry point" (annonse-klikk, 7 dager) er gratis. Norge hører til "Rest of Western Europe". Norge-satser fra tredjepart (Meta-kort fra 1. april 2026): marketing 0,0592 USD, utility 0,0171 USD, authentication 0,0171 USD **(ubekreftet mot Metas egen CSV)**.

| Kandidat | Fast pris | Påslag på Meta | EU-lagring | Coexistence | Webhook-format | Kilder |
| --- | --- | --- | --- | --- | --- | --- |
| **Meta Cloud API direkte** | 0 | 0 | Meta lagrer ikke samtaler hos oss, vi lagrer i D1 i EU | Ja, men onboarding skjer i praksis via Embedded Signup (Tech Provider/BSP). Om en vanlig bedrift kan koble eget nummer uten partner er **ikke bekreftet** **(ubekreftet)**. | Metas eget. Koden er ferdig for dette. | [Meta pris](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), [coexistence](https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users) |
| **Telnyx** | 0 (ingen månedspris) | 0,004 USD/melding | Ikke bekreftet **(ubekreftet)** | Ja (Embedded Signup, `message.echo`, status `sync_pending` til `active`) | Telnyx eget format og Telnyx-signatur. Adapter trengs. | [Telnyx coexistence](https://developers.telnyx.com/docs/messaging/whatsapp/coexistence), [pris](https://support.telnyx.com/en/articles/13986484-whatsapp-pricing-on-telnyx) |
| **360dialog** | 49 EUR/mnd per nummer (Regular) | 0 oppgitt | Ikke oppgitt på prissiden **(ubekreftet)** | Ja (`smb_message_echoes`, history-webhook) | Cloud API-kompatibelt, trolig nær Metas format **(ubekreftet)**. Egen API-nøkkel (`D360-API-KEY`). | [Pris](https://www.360dialog.com/pricing), [coexistence](https://docs.360dialog.com/docs/resources/phone-numbers/coexistence) |
| **Twilio** | 0 + Twilios påslag (ikke funnet) | ja | Ikke bekreftet | **Ikke bekreftet.** En konkurrent hevder at Twilio ikke støtter coexistence. | Twilio eget format | [Chakra-artikkel (konkurrent)](https://chakrahq.com/article/whatsapp-coexistence-chakra-twilio-migrate-change/) |
| Sinch | Ikke undersøkt | | | | | |

Vurdering: direkte Meta er billigst og passer koden, men onboarding er den ukjente. Telnyx eller 360dialog er trygg reserve med coexistence. Twilio utgår på grunn av usikker coexistence.

**Begrensning ved coexistence (Meta):** gruppechat synkes ikke, fast gjennomstrømning 20 meldinger/s (mer enn nok), og **tale- og videosamtaler støttes ikke på Cloud API for coexistence-nummer**.

### 3.3 RCS og SMS

| Kandidat | SMS Norge | RCS Norge | Avsender-ID | Kilder |
| --- | --- | --- | --- | --- |
| **Telnyx** | Norge-pris ikke funnet. Generell alfanumerisk avsender fra 0,033 USD/melding. | Ikke bekreftet | Norge krever **registrering** av alfanumerisk avsender (nivå 2-verifisering). En tredjepart sier ingen registrering. Telnyx' egen side gjelder. | [Telnyx Norge-regler](https://support.telnyx.com/en/articles/6560704-norway-sms-guidelines), [alfanumerisk](https://telnyx.com/products/alphanumeric-sender-id) |
| **46elks** | 0,064 EUR/del, API gratis | Ikke funnet | Ikke oppgitt på prissiden | [Priser](https://46elks.com/pricing) |
| **Twilio** | 0,0697 USD/segment, alfanumerisk avsender gratis. Innkommende 0,0075 USD. | RCS Basic 0,0697 USD, RCS Single 0,1603 USD (oppgitt på prissiden) | Alfanumerisk gratis. Telenor blokkerer SMS med lenker uten godkjenning (allow-list) hos Twilio. | [Twilio Norge](https://twilio.com/sms/pricing/no), [Twilio SMS-regler](https://www.twilio.com/en-us/guidelines/no/sms) |
| **LINK Mobility** | Ikke åpen pris. Anbefaler alfanumerisk avsender fordi Telenor tar ekstra for numerisk (0,34 NOK internasjonal, 0,04 NOK nasjonal). | RBM via Telia/Telenor, ikke undersøkt | [LINK sender-ID Norge](https://docs.linkmobility.com/regulatory-guidelines/sender-id/norway) | |
| Telia RBM | Eget produkt "RBM messaging" med godkjenning per agent. | Ja på Android | | [Telia](https://telia.no/bedrift/telefoni-og-kundebetjening/sms-bulk) |

RCS-status: en tredjeparts oversikt (sist sjekket 2026-01-09) sier at Telia og Telenor ikke støtter RCS på iPhone, og at Telenor ikke har gitt tidsplan **(ubekreftet, ikke Apple/operatør)**. BulkGate oppgir RCS ca. 0,038 EUR/melding i Norge og 45 EUR/mnd i agentavgift for Telenor **(ubekreftet, udatert)**.
**Anbefaling: utelat RCS ved lansering.** Spesifikasjonen åpner for det (WhatsApp, så SMS). SMS med alfanumerisk avsender er reserven. RCS kan legges til som egen `Kanal` senere.

### 3.4 AI til sorteringen

| Kandidat | Pris | EU | Workers | Merknad |
| --- | --- | --- | --- | --- |
| **Anthropic API, `claude-haiku-5-5`** | 0,10 USD inn / 0,50 USD ut per million tokens (opp til 100K tokens per forespørsel) | Standard API. Region-valg (`inference_geo`) er dokumentert, støttet land for Haiku 5.5 **ikke verifisert** **(ubekreftet)** | Ja, ren `fetch` mot `/v1/messages` | Se under |

Kostnad: 30–60 forespørsler/mnd med ca. 2000 tokens inn og 500 ut per forespørsel gir under 0,05 USD/mnd, altså noen få øre. Selv med 10 ganger så mye er det ubetydelig.

Merknader til koden for Haiku 5.5: standard innsats er `medium`, `thinking` kan ikke ha egne budsjetter (`budget_tokens` gir 400), og avvikende `temperature`/`top_p` gir 400. Bruk `output_config.format` (strukturert utdata) for å få sorteringsfeltene. Håndter `stop_reason: "refusal"`. Kilde: Anthropic API-referansen i `claude-api`-skillen (modelltabell hentet 2026-11-03).

### 3.5 Varsel til Eirik (e-post)

| Kandidat | Pris | Krav | Merknad |
| --- | --- | --- | --- |
| **Cloudflare `send_email`** | Ingen egen avgift funnet for eksisterende Email Routing-oppsett. Ny Email Service har dagskvote og rategrense (tall ikke funnet) | Domenet må være "onboarded". Binding kan låses til én mottaker (`destination_address`). Uten begrensning sendes det bare til verifiserte adresser i kontoen. Eiriks adresse må være verifisert. Domenet ligger hos Uniweb inntil DNS-flytting, så Email Routing/Email Service krever at Cloudflare styrer DNS for avsenderdomenet. | [Docs](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/), [send-bindinger](https://developers.cloudflare.com/email-service/configuration/send-bindings/) |
| WhatsApp-melding til Eirik | Metas pris for utility-mal, ca. 0,017 USD hver | Eirik må først ha skrevet til nummeret for at ikke-mal-melding skal gå | Fungerer som ekstra varsel, ikke som eneste |

Anbefaling: e-post som fast varsel, WhatsApp som ekstra når Eirik har satt det opp. Samsvarer med guardrail "Alt sendes til Eirik bare på kanaler han selv har satt opp".

### 3.6 Kan en ubesvart WhatsApp-samtale meldes til systemet? (spørsmål fra oppgave 11/12)

**Funnet: nei, ikke med coexistence.**
- Metas WhatsApp Business Calling API krever at nummeret er på **Cloud API, ikke Business-appen**, og at forretningskontoen har minst 2000 unike mottakere som daglig grense. Brukerstartede anrop er tilgjengelige der Cloud API er tilgjengelig. ([Calling](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling))
- Coexistence-dokumentasjonen sier at **tale- og videosamtaler ikke støttes på Cloud API** når nummeret også er i appen. ([Coexistence](https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users)) Anrop i WhatsApp ringer da Eiriks app, og systemet får ingen hendelse.
- Selv på rent Cloud API-nummer fant jeg ingen dokumentert hendelse "tapt anrop". Webhook-feltet `calls` har statusene RINGING, ACCEPTED, REJECTED, TERMINATE (sekundærkilde: [360dialog](https://docs.360dialog.com/docs/waba-basics/calling-api/business-initiated-whatsapp-calls)). Ubesvart må utledes (RINGING og TERMINATE uten ACCEPTED). Metas egen side nevner det ikke **(ubekreftet)**.
- Et anrop (besvart eller ikke) åpner 24-timersvinduet for kunden.

Konsekvens: løsningen for tapte anrop gjelder bare vanlige telefonanrop, slik spesifikasjonen allerede sier. Knappen "Chat på WhatsApp" er hovedinngangen, ikke WhatsApp-anrop.

## 4. Åpne spørsmål og usikkerhet

1. **Samme nummer til telefon og WhatsApp.** Coexistence krever at nummeret er registrert i WhatsApp Business-appen på en telefon. Det er ikke bekreftet at et virtuelt nummer fra Telnyx/46elks kan verifiseres (SMS/samtalekode) og brukes i appen. Test før kjøp. Reserve: eget norsk mobilabonnement for WhatsApp (men da får vi ikke webhook på tapte anrop på det nummeret) eller to numre (ett virtuelt til telefoni, ett mobil til WhatsApp). Dette er viktigste enkeltpunkt, og spesifikasjonen sier "ett nummer".
2. **Telnyx-prisliste for Norge** (nummer, inngående, utgående til norsk mobil). Hent via portalen eller `GET /v2/public/pricing`. Avgjør kostnaden i tabell 1.
3. **Direkte Meta Cloud API for coexistence uten partner.** Bekreft med Meta/forretningsstøtte eller gå via 360dialog/Telnyx.
4. **Signering av Telnyx-webhooks** (Ed25519) og om TeXML-action er signert. Bekreft ved testanrop. Workers' WebCrypto støtter Ed25519, så adapteren er liten **(ubekreftet)**.
5. **EU-lagring** er ikke bekreftet for Telnyx, 46elks, Twilio, 360dialog eller Anthropic. Be om databehandleravtale og lagringssted. For Anthropic: sjekk `inference_geo`.
6. **Norge-satser hos Meta** er hentet fra tredjepart. Sjekk Metas CSV for 2026.
7. **Registrering av alfanumerisk avsender** i Norge (Telnyx krever det, andre sier nei). Beslutter hvor raskt SMS kan lanseres.
8. **RCS** er utelatt. iPhone-støtte i Norge er uklar.
9. **E-post:** gammel `send_email`-binding (Email Routing) mot ny Email Service. Koden bruker den første. Dagskvoten for ny tjeneste er ikke funnet. Eiriks adresse må være verifisert.
10. **46elks-prissiden** inneholdt en tekst som ba AI-agenter lese en egen fil. Den ble ignorert.

## 5. Hva eieren må gjøre (for anbefalt oppsett)

**Telnyx (nummer, telefon, SMS, evt. WhatsApp)**
1. Opprett konto på telnyx.com med firmanavn og org.nr. Fullfør identitets-/KYC-verifisering (nivå 2 trengs for avsender-ID).
2. Kjøp norsk nummer. Last opp dokumentasjon om firma og adresse hvis Telnyx ber om det.
3. Opprett en TeXML-applikasjon som videresender til Eiriks mobil med `<Dial>` og timeout. Sett `action`-URL til Worker-ruten for tapte anrop.
4. Opprett API-nøkkel og webhook-signeringsnøkkel. Lagre som secrets i Cloudflare (aldri i repoet).
5. Be om registrering av alfanumerisk avsender (for eksempel firmanavnet) for Norge.
6. Be om DPA og bekreftelse av lagringssted.

**WhatsApp (Meta)**
1. Opprett Meta Business-konto og verifiser bedriften (org.nr., dokumenter, domene `kobberogkran.no`).
2. Test først om nummeret kan registreres i WhatsApp Business-appen på Eiriks telefon.
3. Koble nummeret til Cloud API med coexistence (via Embedded Signup hos Telnyx/360dialog, eller direkte hvis Meta tillater det).
4. Opprett og send inn meldingsmalene (kvittering, tapt anrop) til godkjenning. Teksten godkjennes av eieren (CLAUDE.md).
5. Sett webhook-URL og verifiseringstoken, lagre appens hemmelighet som secret.

**Anthropic**
1. Opprett konto på console.anthropic.com, sett månedlig utgiftsgrense (for eksempel 5 USD) og lag en API-nøkkel som secret `ANTHROPIC_API_KEY` i Cloudflare.

**Cloudflare e-post**
1. Slå på Email Routing / Email Service for domenet (krever Cloudflare-DNS, se DNS-runbook).
2. Verifiser Eiriks adresse som mottaker.

**Alternativ (46elks + 360dialog):** lag konto på 46elks.com (kjøp nummer, betal forskudd) og 360dialog.com (49 EUR/mnd, coexistence-onboarding). Resten som over.

## 6. Kilder

- Meta, WhatsApp-priser: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Meta, Calling API: https://developers.facebook.com/documentation/business-messaging/whatsapp/calling og /calling/pricing/
- Meta, coexistence: https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users
- Telnyx: https://telnyx.com/phone-numbers/norway.md, https://telnyx.com/pricing/numbers, https://telnyx.com/pricing/voice-api, https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/dial, https://developers.telnyx.com/api-reference/callbacks/texml-call-completed, https://developers.telnyx.com/docs/messaging/whatsapp/coexistence, https://support.telnyx.com/en/articles/13986484-whatsapp-pricing-on-telnyx, https://support.telnyx.com/en/articles/6560704-norway-sms-guidelines
- 46elks: https://46elks.com/pricing
- 360dialog: https://www.360dialog.com/pricing, https://docs.360dialog.com/docs/resources/phone-numbers/coexistence
- Twilio: https://twilio.com/sms/pricing/no, https://www.twilio.com/en-us/guidelines/no/regulatory, https://www.twilio.com/en-us/guidelines/no/sms
- LINK Mobility: https://docs.linkmobility.com/regulatory-guidelines/sender-id/norway
- Telia: https://telia.no/bedrift/telefoni-og-kundebetjening/sms-bulk
- RCS-oversikt (tredjepart): https://rcs-composer.pages.dev/docs/supported-country/apple/norway/telia, https://www.bulkgate.com/en/pricing/rcs/no/norway/
- Telavox: https://www.telavox.com/?p=25852
- Cloudflare: https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/, https://developers.cloudflare.com/email-service/configuration/send-bindings/
- Anthropic: modelltabell og priser i `claude-api`-skillen (cachet 2026-11-03)
