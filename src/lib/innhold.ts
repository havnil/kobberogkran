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

/** Copy for the front page sections. Working titles from the spec until a human writes the final text. */
export const forsideSchema = z.object({
  hero: z.object({
    /** Small place line above the big title. */
    stedslinje: z.string(),
    tittel: z.string(),
    ingress: z.string(),
    /** The three promises in the fact box. */
    lover: z.array(z.string()),
  }),
  tjenester: z.object({ tittel: z.string() }),
  varmtvann: z.object({
    tittel: z.string(),
    /** Label on the big fixed price: «arbeid». */
    arbeidMerke: z.string(),
    typiskTotalMerke: z.string(),
    medTittel: z.string(),
    med: z.array(z.string()),
    ikkeMedTittel: z.string(),
    ikkeMed: z.array(z.string()),
  }),
  priser: z.object({
    tittel: z.string(),
    timepris: z.string(),
    servicebil: z.string(),
    forbruk: z.string(),
    regneeksempel: z.string(),
    delerNote: z.string(),
  }),
  steg: z.object({ tittel: z.string(), steg: z.array(stegSchema) }),
  omEirik: z.object({
    tittel: z.string(),
    tekst: z.string(),
    godkjenningerTittel: z.string(),
    anmeldelserTittel: z.string(),
    /** Badge on example testimonials (shown outside production only). */
    eksempelMerke: z.string(),
  }),
  omrader: z.object({ tittel: z.string() }),
  skjema: z.object({ tittel: z.string(), merknad: z.string() }),
});

export const tekstSchema = z.object({
  kvittering: z.string(),
  taptAnrop: z.string(),
  /** Template for the WhatsApp greeting. Placeholders: {tjeneste}, {kilde}. */
  whatsappHilsen: z.string(),
  forside: forsideSchema,
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
