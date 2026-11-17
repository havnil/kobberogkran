# SDD ledger — plan: docs/superpowers/plans/2026-11-12-nettside.md

Spec: docs/superpowers/specs/2026-11-12-nettside-design.md (reachable). Branch: feat/nettside (from design/forside-research @ plan commit).

## Pre-flight scan

| Rad | Funn | Ruling |
|---|---|---|
| T1 ↔ T2 (Header/Footer ↔ getFirma) | T1 bygger Header/Footer, T2 kobler dem til firmadata; T1 trenger telefonnummer for `tel:` før T2 finnes | Ruling: kjør T2 før T1; T2 lager ikke Header/Footer-koblingen, den flyttes inn i T1 som bruker getFirma() — fjerner sirkulær avhengighet — koster lite om feil |
| T1 ↔ T9 (wa.me) | T1 check-dist krever `href="https://wa.me/`, men waLenke kommer i T9 | Ruling: T1 lager wa.me-href inline fra firma.whatsapp; T9 trekker ut waLenke og erstatter inline — koster en liten refaktor |
| T1 ↔ T3 (undermeny Tjenester) | T1 Header skal liste 5 tjenester fra samling som først lages i T3 | Ruling: T1 lenker «Tjenester» til /tjenester/ uten undermeny; T3 legger til undermenyen fra samlingen — koster ingenting |
| T4 ↔ T8 (skjema-plass) | T4 lager plass `id="skjema"`, T8 fyller | ok |
| T5 ↔ T3 | T5 bruker tjenester-samling fra T3 | ok |
| T7 ↔ T11/T12 | T7 bruker sorterOgVarsle og sendMedReserve | Plan sier rekkefølge 6→11→12→7→8; følges |
| T11 server-firmadata | Plan: «serialiseres inn ved bygging til src/server/firma-data.ts» — uspesifisert byggesteg | Ruling: serverkode importerer `src/content/firma/firma.json` direkte (JSON-import, validert med samme Zod-skjema fra src/lib/firma.ts) — ingen ekstra byggesteg — koster lite om feil |
| T10 ↔ T11/T12 | Ekte leverandører krever eiers valg | Ruling: T10 leverer forslag; T11 implementerer ClaudeSorterer (plan valgte claude-haiku-5-5) + falske; T12 implementerer bare falske kanaler + grensesnitt; ekte kanal-/telefoniadaptere parkeres til eier har valgt — koster en oppfølgingsoppgave |
| T6 | @cloudflare/vitest-pool-workers kompatibilitet med Vitest 5 ukjent | Ruling: implementer velger pool-workers hvis kompatibel, ellers Miniflare/D1 via `wrangler`'s getPlatformProxy eller better-sqlite3-basert test av SQL — rapporteres |
| T2 | CI kjører check:launch uten LAUNCH → passerer | ok |
| T13 | Endrer CLAUDE.md (guardrail) | ok, menneskelig PR-godkjenning uansett |
| Alle T | Endelig tekst skrives av menneske | Implementere bruker `PLASSHOLDER: `-prefiks og `[EN] ` |

Kjørerekkefølge: 2, 1, 3, 4, 5, 9, 6, 11, 12, 7, 8, 10, 13.

## Progress
Task 2: dispatched (BASE 4350f5b, implementer a782a220a3763b187, model sonnet)
Task 2: implementer DONE b32d91a; firma.json shape {firma:{...}} → server must parse json.firma; review dispatched (a5d3685c139761569)
Task 2: review approved; ⚠️ resolved by controller: (a) PLASSHOLDER text in md/json + [EN] not scanned = real gap; (b) LAUNCH not enforced in Workers Builds = real gap → fix round 1 sent (FIX_BASE b32d91a)
Task 2: minor (deferred): Plassholder.astro badge class unstyled (Task 1 to style); getFirma re-parses; Verdi<T> hand-written beside Zod; no render test for Plassholder
Task 2: fix round 1/5 (3 addressed, 0 open; commits b32d91a..270d7d2)
Task 2: minor (deferred): ATTR \b matches data-plassholder-*; per-line scan misses split tags; owner must confirm Workers Builds build command = npm run build
Task 2: complete (commits 4350f5b..270d7d2, review clean)
Task 1: dispatched (BASE 270d7d2)
Task 1: Ruling: placeholder pages for menu targets created in T1 so offline link check passes — T3/T5 replace them — costs little. implementer ab3556dc2a597d571 (sonnet)
Task 1: implementer DONE_WITH_CONCERNS 40e2dac; review: Needs fixes (bottom bar clipping, tel: drops +) → fix round 1 sent (FIX_BASE 40e2dac)
Task 1: minor (deferred): no og:url; long @font-face lines; public/og-image.png + apple-touch-icon.png need human approval; WCAG contrast unmeasured (final review)
Task 1: fix round 1/5 (4 addressed, 0 open; commits 40e2dac..2b198e8)
Task 1: minor (deferred): unused --bunnlinje-hoyde token; header 1000-1100px + bar line counts not measured in browser (final visual check)
Task 1: complete (commits 270d7d2..2b198e8, review clean)
Task 3: dispatched (BASE 2b198e8)
Task 3: Ruling: T3 adds Header submenu + minimal service routes (servicePaths) so link check passes; T5 builds full template — costs little. Ruling: tekster gets whatsappHilsen key for T9. implementer af4e981d461c3c716
Task 3: implementer DONE 19abc09; review Needs fixes → fix round 1 sent (FIX_BASE 19abc09)
Task 3: Ruling: tekster becomes non-i18n file collection with nb/en file entries — avoids undocumented {{locale}}+multiple_folders path — costs slightly less elegant CMS UI
Task 3: Ruling: check-translations extended to tjenester (⚠️ confirmed gap)
Task 3: minor (deferred): tjenesteSchema.locale hardcodes nb/en; slug template with PLASSHOLDER titles if create enabled; /images/uploads/plassholder.jpg missing (T5 must handle); CMS live /admin verification impossible until sveltia-cms-auth deployed (owner step)
Task 3: fix round 1/5 (4 addressed, 0 open; commits 19abc09..9e259f7); controller verified Header toggles aria-expanded (Header.astro:109,119)
Task 3: minor (deferred): firma drift test only checks fields[0]; en visUndermeny lacks PLASSHOLDER token (gate still catches [EN])
Task 3: complete (commits 2b198e8..9e259f7, review clean)
Task 4: dispatched (BASE 9e259f7)
Task 4: Ruling: forside copy in tekster.forside (CMS-editable, placeholder); skjema button → #skjema on pages with form (BaseLayout prop) else contact; examples shown with badge unless PROD+LAUNCH. implementer a6cac1d2774ec44b0
Task 4: implementer DONE_WITH_CONCERNS 5b311c6..aa7107b; review Needs fixes (FDV/våtrom doc missing; header skjema button only ≥1560px) → fix round 1 sent (FIX_BASE aa7107b)
Task 4: Ruling: header skjema button must show from 1000px (spec) — compact icon buttons allowed — costs header rework
Task 4: minor (deferred): cabin season text fixed at build time — needs periodic rebuild (T13 runbook: monthly deploy hook or note); TjenesteKort long link name; aktivSesong local timezone; mobile length ≤8 screens unverified by reviewer (final visual check)
Task 4: fix round 1/5 (4 addressed, 0 open; commits aa7107b..b546e0f)
Task 4: minor (deferred): Ring/WhatsApp icon-only 1000–1599px (owner UX confirm); .etikett absolute w/o positioned ancestor; long placeholder button label wraps
Task 4: complete (commits 9e259f7..b546e0f, review clean)
Task 5: dispatched (BASE b546e0f)
Task 5: implementer af6cc568d03f34db9 (sonnet). Ruling: service + contact pages get #skjema placeholder with data-tjeneste and harSkjema; prices wrapped in data-pris.
Task 5: review approved (commits 4ff2d20, 8396aa2)
Task 5: minor (deferred): no test for placeholder breadcrumb name omission; hero img alt="" + hardcoded 1200x600 (alt text needs human); form eyebrow separator in code; breadcrumb '/' via ::after; data-tjeneste values = translationKey (T8 must use same set)
Task 5: complete (commits b546e0f..8396aa2, review clean)
Task 9: dispatched (BASE 8396aa2)
Task 9: Ruling: kilde injected client-side into a[data-wa] text= via tiny inline script (static pages can't know ?kilde=), no storage — costs a few lines of JS. implementer aaf6b81123ead5538
Task 9: implementer DONE 885cec4; review Needs fixes (word-eating heuristic, newline collapse) → fix round 1 sent (FIX_BASE 885cec4)
Task 9: Ruling: explicit optional segments [ … ] in whatsappHilsen template; CMS hint wording flagged for owner — costs a template syntax editors must learn
Task 9: minor (deferred): data-wa-mal repeated on 4 links; kundeTittel containing {kilde} edge case
Task 9: fix round 1/5 (3 addressed, 0 open; commits 885cec4..87d615c)
Task 9: minor (deferred): CMS hint label contains PLASSHOLDER: (owner reviews wording; gate scans HTML only so not blocking); second fill pass edge case
Task 9: complete (commits 8396aa2..87d615c, review clean)
Task 6: dispatched (BASE 87d615c)
Task 6: Ruling: do NOT add D1/R2/send_email bindings to wrangler.jsonc yet — resources don't exist, a fake database_id would break Workers Builds deploys/previews; T6 writes migration + db.ts + tests + a typed Env interface; T13 runbook gives the exact wrangler.jsonc snippet the owner applies (via PR) after creating resources — costs one extra owner PR
Task 6: implementer DONE 1d90442 (Miniflare 4 in plain vitest); review Needs fixes (kunde upsert drops later data) → fix round 1 sent (FIX_BASE 1d90442)
Task 6: Ruling: add registrerSamtykke/sisteSamtykke now (T7 needs a consent write path) + CHECK gitt — costs scope creep into T6
Task 6: minor (deferred): orphan kunde possible (no batch); no CHECK on hast/kilde/foretrukket_kanal; no ON DELETE rules (GDPR erasure manual); migration split on ';' in tests; two miniflare trees in lockfile; nettside-eiersteg.md not linked from CLAUDE.md (T13)
Task 6: fix round 1/5 (3 addressed, 0 open; commits 1d90442..6e869cb)
Task 6: minor (deferred): FK test asserts any throw (not /FOREIGN KEY/); last non-null navn wins silently; editing 0001 only safe before first apply (runbook note, T13)
Task 6: complete (commits 87d615c..6e869cb, review clean)
Task 11: dispatched (BASE 6e869cb)
Task 11: Ruling: notification = e-mail via Cloudflare send_email (EpostVarsler, plain-text MIME, no attachments); images reach Eirik as HMAC-signed expiring links `/api/bilde/<bildeId>?utloper=<ts>&sig=<hmac>` — T11 provides signer `signerBildeLenke`/`verifiserBildeLenke`, T7 adds the GET route — costs a route not in plan
Task 11: Ruling: T7 must normalise '' → null before opprettForesporsel (from T6 re-review)
Task 11: implementer a1f46f54c6c8bebf9 (opus — integration + external API + design judgment). svar_json assumption {felles, tjenesteSvar, bildeMerker?} must be honoured by T7/T8.
Task 11: implementer DONE d32933a; review Needs fixes (double-send race; unverified anthropic-version/effort) → fix round 1 sent (FIX_BASE d32933a)
Task 11: Ruling: sorting triggered after step 1 (fast for leaks); step 2/images later produce a separate short «tillegg» e-mail to Eirik without AI (T7) — costs a second e-mail; first e-mail may list items as missing that arrive in step 2
Task 11: minor (deferred): hytte/bronn treated as hourly in prisanslag; sortering_feil never surfaced to owner (watchdog?); HMAC msg ambiguity with ':' in id (UUIDs fine)
Task 11: fix round 1/5 (3 addressed, 1 open — lease release lacks owner check; commits d32933a..d69f33e); round 2 sent (FIX_BASE d69f33e). Controller: 0001 not applied anywhere, in-place edit OK. minor (deferred): Anthropic params verified only via skill citations, no live call — verify one real call before launch (owner runbook)
Task 11: fix round 2/5 (1 addressed, 0 open; commits d69f33e..38cc165)
Task 11: minor (deferred): silent no-op on mismatched lease release (no warn); live Anthropic call unverified
Task 11: complete (commits 6e869cb..38cc165, review clean)
Task 12: dispatched (BASE 38cc165)
Task 12: Ruling: provider-neutral — real Meta WhatsApp webhook (hub.challenge + X-Hub-Signature-256) is standard and implemented now; telephony webhook uses a generic HMAC shared-secret verifier behind an interface until owner picks provider (T10); outbound channels only fakes + interface; missed-call dedupe needs new table `anrop` in 0001 (not applied anywhere) — costs provider adapters later
Task 12: implementer DONE d110f44; review Approved w/ 1 Important (D1 failure loses Eirik notification) → fix round 1 sent (FIX_BASE d110f44)
Task 12: minor (deferred): no replay freshness window (add when provider chosen); anrop table retention undecided (owner/privacy policy + purge); reserved row blocks retry 30 min if all channels fail; 0047 treated as withheld; taptAnrop template lacks link vars (links appended); taptAnropVariabler uses nb greeting
Task 12: fix round 1/5 (4 addressed, 0 open; commits d110f44..20dc183)
Task 12: complete (commits 38cc165..20dc183, review clean)
Task 7: dispatched (BASE 20dc183)
Task 7: implementer a08903624381158e4 (opus). Rulings: tillegg e-mail debounced ~2min; skjema token prefix 'skjema:'; GET /api/bilde/[id] signed; send-bilder + takk pages; no-JS form post → 303; Turnstile fail-closed; honeypot silent 201.
Task 7: Ruling: tillegg debounce window 20 s (waitUntil ~30 s, no cron) instead of ~2 min — costs up to a few extra e-mails in bursts
Task 7: implementer DONE_WITH_CONCERNS b3ab790; review Needs fixes (no-JS idempotency, phone in errors, business fields, EXIF) → fix round 1 sent (FIX_BASE b3ab790)
Task 7: Ruling: business contract kundetype/firmanavn/orgnr (mod-11) as columns on foresporsler; not sent to AI — costs schema columns
Task 7: Ruling: server strips JPEG APP1; HEIC converted client-side (T8); raw no-JS HEIC accepted with logged limitation — costs possible GPS retention in rare no-JS HEIC uploads (privacy text must mention)
Task 7: Ruling: no-JS idem key = sha256(turnstile token); siteverify idempotency_key
Task 7: minor (deferred): tillegg loss if e-mail fails/eviction with no later change (no cron); clock skew edge; HEIC mif1/msf1 vs AVIF; no-JS 401/503 raw JSON; no-JS validation error loses input; token never expires; ~30MB peak copies; kunder upsert lets stranger with same phone overwrite navn/epost
Task 7: fix round 1/5 (5 addressed, 0 open; commits b3ab790..9cac045)
Task 7: minor (deferred): EXIF orientation lost on raw JPEG uploads (T8 client rotates); WebP stored with metadata; COM/other APPn kept; merke left in svar_json if loggTillegg throws
Task 7: complete (commits 20dc183..9cac045, review clean)
Task 8: dispatched (BASE 9cac045)
Task 8: implementer a133f6e5389726d37 (opus). Ruling: no-JS path = noscript note with phone + WhatsApp (Turnstile needs JS) — costs no-JS users can't submit the form; Ruling: PUBLIC_TURNSTILE_SITE_KEY build env, test key in dev only
Task 8: implementer DONE_WITH_CONCERNS 45f238e; review dispatched (opus). Cross-task: process.env.LAUNCH possibly undefined in prerender (T4 Forside/Side) — pending reviewer check
Task 8: review Needs fixes (consent withdrawal) → fix round 1 sent (FIX_BASE 45f238e)
Task 8: Ruling: cross-task LAUNCH bug (T4/T5 process.env.LAUNCH undefined in workerd prerender) fixed inside T8 fix round via import.meta.env.LAUNCH helper — load-bearing for launch — costs T8 touching T4/T5 files
Task 8: Ruling: WhatsApp consent checkbox added in form (spec Meldingskanaler) inside T8
Task 8: minor (deferred): leak/blocked-drain as follow-ups under service-og-reparasjon (owner approve); receipt template {variabler} stripped on screen may dangle; canvas failure → full-size upload may 413; gnr/bnr error focus; honeypot label hardcoded; heic2any unmaintained (prod audit 0 vulns); HEIC conversion failure uploads original with metadata
Task 8: fix round 1/5 (7 addressed, 0 open; commits 45f238e..6418822); implementer verified real LAUNCH=true build hides examples
Task 8: minor (deferred): in-flight WhatsApp consent PATCH + step2 can double-record (sisteSamtykke read/insert not atomic) and cause extra tillegg mail; visSteg2 closure untested; inline script vs future CSP
Task 8: complete (commits 9cac045..6418822, review clean)
Task 10: dispatched (BASE 6418822)
Task 10: implementer DONE_WITH_CONCERNS b21f77e (rec: Telnyx + Meta Cloud API/360dialog; WhatsApp missed calls not reportable; 46elks page had prompt-injection text — ignored); review Needs fixes (risks not prominent) → fix round 1 sent (FIX_BASE b21f77e)
Task 10: fix round 1/5 (3 addressed, 0 open; commits b21f77e..83cc744)
Task 10: minor (deferred): 3.1 Vurdering untagged Twilio claims; wording nits; 1 USD=1 EUR rough
Task 10: complete (commits 6418822..83cc744, review clean)
Task 13: dispatched (BASE 83cc744)
Task 13: review approved (7a56565)
Task 13: minor (deferred): step 4 depends on step 7 ordering; 2000px downscale fact dropped from privacy section; no `wrangler secret put` example in steps 9–10
Task 13: complete (commits 83cc744..7a56565, review clean)
Final review: dispatched (4350f5b..HEAD)
Final review: Ready to merge after fixes — I1–I8 Important (sorting ignores step 2; AKUTT lost; no notification retry; gate blind to en.json; classifier unguarded paths; address to Anthropic; no send-photos link w/o channels; WCAG contrast). Fix wave dispatched (FIX_BASE 7a56565, agent a828fe1193e1ac28f) with final-findings.md
Final: Ruling: I1 re-run regelsjekk + one Haiku call in step-2 tillegg e-mail — costs ~1 extra AI call per request
Final: Ruling: I8 text on orange uses --color-brown-dark; field borders brand-muted — costs a small visual change from brand mockups
Final: Ruling: I7 no build failure for zero channels (runtime config); Eirik's e-mail states when customer got no receipt
Final: fix wave done 7a56565..e68a20d (8 commits; 455 tests); scoped re-review dispatched (a65950f7248b606a6)
Final: re-review all findings addressed; CI-equivalent green in clean worktree (455 tests, build, check-dist)
Final: parked — step-2 tillegg near waitUntil limit (20s+8s) — Ruling: accept; lower gather window before launch if logs show cut-offs — costs a possibly lost step-2 tillegg
Final: parked — consent PATCH may win lock and omit receipt-status line — Ruling: accept (rare, no duplicate) — costs one missing status line
Final: parked — retried main e-mail on 'sortert' reuses step-1 AI summary — Ruling: accept (rules + raw step-2 included) — costs stale AI summary in rare retries
Final: parked — sweep ORDER BY opprettet LIMIT 10 can starve — Ruling: accept until cron is wired; revisit then — costs delayed retries under >10 permanent failures
Final: dev-dependency audit: 3 high (prod 0) — Ruling: leave for Dependabot/owner — costs nothing at runtime
