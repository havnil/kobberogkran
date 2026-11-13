// Content schemas for services, UI texts and testimonials. Plain Zod so tests can import them
// without Astro. All visible copy is placeholder (`PLASSHOLDER: ` / `[EN] `) until a human writes it.
import { z } from 'astro/zod';

export const tjenesteSchema = z.object({
  title: z.string(),
  /** The customer's own words. */
  kundeTittel: z.string(),
  /** The trade term, shown as subtitle. */
  fagord: z.string(),
  nummer: z.number().int().min(1).max(5),
  kort: z.string(),
  fakta: z.array(z.object({ tall: z.string(), tekst: z.string() })),
  faq: z.array(z.object({ sporsmal: z.string(), svar: z.string() })),
  /** Seasonal card text (cabin): `host` in autumn/winter, `var` in spring/summer. */
  sesong: z.object({ host: z.string(), var: z.string() }).optional(),
  bilder: z.array(z.object({ src: z.string(), plassholder: z.boolean() })),
  translationKey: z.string(),
  locale: z.enum(['nb', 'en']),
});

const stegSchema = z.object({ tittel: z.string(), tekst: z.string() });
const lenkeSchema = z.object({ tekst: z.string(), anker: z.string() });

/** Copy for the front page sections. Working titles from the spec until a human writes the final text. */
export const forsideSchema = z.object({
  hero: z.object({
    /** Small place line above the big title. */
    stedslinje: z.string(),
    tittel: z.string(),
    ingress: z.string(),
    /** The last line of the title, shown in the accent colour. Must be the end of `tittel`. */
    tittelAksent: z.string(),
    /** The three promises in the fact box. */
    lover: z.array(z.string()),
    /** Seasonal badge above the title: `host` in autumn/winter, `var` in spring/summer. `anker` is a heading id on the cabin page. */
    sesongmerke: z.object({ host: lenkeSchema, var: lenkeSchema }),
  }),
  /** The key figures card that hangs from the copper pipe in the hero. Values come from `firma`. */
  nokkeltall: z.object({
    eyebrow: z.string(),
    merke: z.string(),
    timepris: z.string(),
    tank: z.string(),
    servicebil: z.string(),
    kjoretid: z.string(),
    kjoretidEnhet: z.string(),
    prisForStart: z.string(),
  }),
  tjenester: z.object({
    /** Title of the services overview page. */
    tittel: z.string(),
    /** Front page: eyebrow (`{antall}` is the number of tiles), title, intro and the tiles. */
    eyebrow: z.string(),
    ruterTittel: z.string(),
    ingress: z.string(),
    seMer: z.string(),
    /** `tjeneste` is a service translationKey; `anker` a heading id on that page (may be empty). */
    ruter: z.array(z.object({ tittel: z.string(), tekst: z.string(), tjeneste: z.string(), anker: z.string() })),
  }),
  /** «I bilen»: what is always in the van. `bruk` is how often it is used, 1 to 5. Drafts until Eirik confirms (`bekreftet`). */
  bil: z.object({
    eyebrow: z.string(),
    tittel: z.string(),
    ingress: z.string(),
    bekreftet: z.boolean(),
    brukEtikett: z.string(),
    /** Screen reader text for the bars. Placeholder: {n}. */
    brukAv: z.string(),
    utstyr: z.array(
      z.object({ navn: z.string(), under: z.string(), bruk: z.number().int().min(1).max(5), verdi: z.string(), enhet: z.string() }),
    ),
  }),
  varmtvann: z.object({
    tittel: z.string(),
    /** Label on the big fixed price: «arbeid». */
    arbeidMerke: z.string(),
    typiskTotalMerke: z.string(),
    medTittel: z.string(),
    med: z.array(z.string()),
    ikkeMedTittel: z.string(),
    ikkeMed: z.array(z.string()),
    /** The featured block on the front page. */
    eyebrow: z.string(),
    ingress: z.string(),
    faktaTotal: z.string(),
    faktaTid: z.string(),
    faktaTidVerdi: z.string(),
    faktaDok: z.string(),
    faktaDokVerdi: z.string(),
    knappBilde: z.string(),
    knappLes: z.string(),
  }),
  /** «Tanksjekk»: the tank-age calculator. Runs in the browser only; nothing is stored or sent. */
  tanksjekk: z.object({
    eyebrow: z.string(),
    tittel: z.string(),
    ingress: z.string(),
    arEtikett: z.string(),
    arHjelp: z.string(),
    knapp: z.string(),
    alderEnhet: z.string(),
    maalerGrense: z.string(),
    /** Answers. Placeholders: {alder}, {fra}, {til}. */
    svarStart: z.string(),
    svarOk: z.string(),
    svarSnart: z.string(),
    svarNaa: z.string(),
    svarUgyldig: z.string(),
    forbehold: z.string(),
    personvern: z.string(),
    /** Shown without JavaScript instead of the calculator. */
    utenJs: z.string(),
    /** Years: from `snartAr` «plan a replacement», from `grenseAr` «replace now» (what insurers tend to expect). */
    snartAr: z.number().int().positive(),
    grenseAr: z.number().int().positive(),
    maksAr: z.number().int().positive(),
  }),
  /** The full-width brown band. */
  band: z.object({ eyebrow: z.string(), tittel: z.string(), tittelAksent: z.string() }),
  priser: z.object({
    tittel: z.string(),
    timepris: z.string(),
    servicebil: z.string(),
    forbruk: z.string(),
    regneeksempel: z.string(),
    delerNote: z.string(),
  }),
  steg: z.object({ eyebrow: z.string(), tittel: z.string(), ingress: z.string(), stegEtikett: z.string(), steg: z.array(stegSchema) }),
  omEirik: z.object({
    tittel: z.string(),
    tekst: z.string(),
    godkjenningerTittel: z.string(),
    anmeldelserTittel: z.string(),
  }),
  /** Documentation (FDV and wet room) shown under «Om Eirik». */
  dokumentasjon: z.object({ tittel: z.string(), punkter: z.array(z.string()) }),
  omrader: z.object({
    eyebrow: z.string(),
    tittel: z.string(),
    ingress: z.string(),
    base: z.string(),
    utenfor: z.string(),
    omtaleEyebrow: z.string(),
  }),
  skjema: z.object({ eyebrow: z.string(), tittel: z.string(), merknad: z.string(), ringDirekte: z.string() }),
});

/** Copy for the service template and the other pages. Working titles until a human writes the final text. */
export const siderSchema = z.object({
  /** Shared by every page: the two extra menu items and the footer. */
  felles: z.object({
    menyVarmtvannstank: z.string(),
    menyLekker: z.string(),
    bunntekst: z.string(),
    kontaktTittel: z.string(),
    adresseTittel: z.string(),
  }),
  tjeneste: z.object({
    /** The hero title reads `<service> <tittelSted> <tittelAksent>`, the last part in the accent colour. */
    tittelSted: z.string(),
    tittelAksent: z.string(),
    prisForStart: z.string(),
    faqEyebrow: z.string(),
    andreEyebrow: z.string(),
    omraderEyebrow: z.string(),
    faktaTittel: z.string(),
    sideboksTittel: z.string(),
    sideboksTekst: z.string(),
    faqTittel: z.string(),
    andreTittel: z.string(),
    omraderTittel: z.string(),
    /** Eyebrow above the form on a service page. */
    skjemaEyebrow: z.string(),
  }),
  priser: z.object({
    kveldHelgNavn: z.string(),
    kveldHelgVerdi: z.string(),
    /** Note under the prices: all prices include VAT. */
    mvaNote: z.string(),
    listeEyebrow: z.string(),
    listeTittel: z.string(),
  }),
  bad: z.object({
    prosessTittel: z.string(),
    prosess: z.array(stegSchema),
    ansvarTittel: z.string(),
    ansvar: z.string(),
  }),
  kontakt: z.object({
    telefonNavn: z.string(),
    epostNavn: z.string(),
    adresseNavn: z.string(),
    kortEyebrow: z.string(),
    rolle: z.string(),
  }),
});

export const tekstSchema = z.object({
  kvittering: z.string(),
  taptAnrop: z.string(),
  /** Template for the WhatsApp greeting. Placeholders: {tjeneste}, {kilde}. */
  whatsappHilsen: z.string(),
  forside: forsideSchema,
  sider: siderSchema,
  lekkerNaa: z.object({
    tittel: z.string(),
    punkter: z.array(z.string()),
    ingenDognvakt: z.string(),
  }),
  skjema: z.object({
    hva: z.string(),
    haster: z.string(),
    hasterLekkerNaa: z.string(),
    hasterSnart: z.string(),
    hasterKanPlanlegges: z.string(),
    adresse: z.string(),
    bruketMinPosisjon: z.string(),
    navn: z.string(),
    telefon: z.string(),
    epost: z.string(),
    bilder: z.string(),
    beskrivelse: z.string(),
    samtykkePaminnelser: z.string(),
    send: z.string(),
    /** Option for a job that is none of the services. */
    tjenesteAnnet: z.string(),
    stedTittel: z.string(),
    stedHjelp: z.string(),
    /** Summary of the disclosure with farm and title number (gnr./bnr.). */
    stedUtenAdresse: z.string(),
    gnr: z.string(),
    bnr: z.string(),
    posisjonHentes: z.string(),
    posisjonFunnet: z.string(),
    posisjonFeilet: z.string(),
    kundetype: z.string(),
    kundetypePrivat: z.string(),
    kundetypeBedrift: z.string(),
    firmanavn: z.string(),
    orgnr: z.string(),
    /** Status while step 1 is being sent. */
    sender: z.string(),
    /** Heading over the receipt (`kvittering`) shown after step 1. Never promises a time. */
    kvitteringTittel: z.string(),
    /**
     * Shown with the link for sending more photos later, under the receipt on screen, when
     * `kvittering` has no `{sendBilderLenke}` (then the link stands where the variable is).
     */
    kvitteringLenke: z.string(),
    steg2Tittel: z.string(),
    steg2Ingress: z.string(),
    sporsmalTittel: z.string(),
    sendSteg2: z.string(),
    steg2Ok: z.string(),
    /** Upload status per photo. */
    bildeLaster: z.string(),
    bildeOk: z.string(),
    bildeFrakoblet: z.string(),
    bildeFeilet: z.string(),
    bildeForMange: z.string(),
    hvorHorte: z.string(),
    /** Fixed options for «Hvor hørte du om oss?» (keys: see HVOR_HORTE in src/client/skjema/sporsmal.ts). */
    hvorHorteValg: z.object({
      google: z.string(),
      anbefaling: z.string(),
      sosialeMedier: z.string(),
      bilen: z.string(),
      annet: z.string(),
    }),
    /** Question labels in step 2, by question id (src/client/skjema/sporsmal.ts). */
    sporsmal: z.object({
      vann: z.string(),
      avlop: z.string(),
      byggear: z.string(),
      adkomst: z.string(),
      kontaktform: z.string(),
      bildeTypeskilt: z.string(),
      bildeTank: z.string(),
      rom: z.string(),
      etasje: z.string(),
      tilkobling: z.string(),
      problem: z.string(),
      vannStengt: z.string(),
      fukt: z.string(),
      forsikringMeldt: z.string(),
      antallAvlop: z.string(),
      bronntype: z.string(),
      bildePumpe: z.string(),
      symptom: z.string(),
      vannprove: z.string(),
      maal: z.string(),
      oppstart: z.string(),
      egneHandverkere: z.string(),
      styregodkjenning: z.string(),
    }),
    /** Option labels, by option key (`valgNokkel` of the value). */
    valg: z.object({
      ja: z.string(),
      nei: z.string(),
      vetIkke: z.string(),
      kommunalt: z.string(),
      bronn: z.string(),
      privat: z.string(),
      sms: z.string(),
      samtale: z.string(),
      stikkontakt: z.string(),
      fast: z.string(),
      lekkasje: z.string(),
      tettAvlop: z.string(),
      annet: z.string(),
      ett: z.string(),
      flere: z.string(),
      borebronn: z.string(),
      gravd: z.string(),
      ikkeBorettslag: z.string(),
    }),
    /** Error texts by code. The phone number is always added after the text. */
    feil: z.object({
      mangler: z.string(),
      ugyldig: z.string(),
      forLang: z.string(),
      turnstile: z.string(),
      nettverk: z.string(),
      server: z.string(),
    }),
    /** Shown without JavaScript (the form needs Turnstile), followed by phone and WhatsApp. */
    utenJs: z.string(),
    /** Consent to a reply on WhatsApp (step 1, not pre-ticked). */
    samtykkeWhatsapp: z.string(),
    /** Screen reader status for the address suggestions. Placeholder: {antall}. */
    forslagAntall: z.string(),
  }),
  /** Takkesiden etter skjemaet uten JavaScript, og siden for å sende flere bilder senere. */
  skjemaSvar: z.object({
    takkTittel: z.string(),
    feilTittel: z.string(),
    feilTekst: z.string(),
    sendBilderTittel: z.string(),
    sendBilderTekst: z.string(),
    sendBilderSend: z.string(),
    sendBilderOk: z.string(),
    sendBilderFeil: z.string(),
    ugyldigLenkeTittel: z.string(),
    ugyldigLenkeTekst: z.string(),
  }),
});

export const omtaleSchema = z.object({
  type: z.enum(['godkjenning', 'referanse', 'anmeldelse']),
  tekst: z.string(),
  navn: z.string().optional(),
  /** Only real testimonials (`true`) may be shown. */
  ekte: z.boolean(),
});

export type Tjeneste = z.infer<typeof tjenesteSchema>;
export type Tekster = z.infer<typeof tekstSchema>;
export type Omtale = z.infer<typeof omtaleSchema>;
