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

export const tekstSchema = z.object({
  kvittering: z.string(),
  taptAnrop: z.string(),
  /** Template for the WhatsApp greeting. Placeholders: {tjeneste}, {kilde}. */
  whatsappHilsen: z.string(),
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
