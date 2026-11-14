// Company data. The schema is plain Zod so server code and tests can import it without Astro;
// `getFirma()` is Astro-only (it reads the `firma` content collection).
// The data file `src/content/firma/firma.json` is `{ "firma": { ... } }` (the file() loader
// keys entries by id), so server code validates `firmaSchema.parse(json.firma)`.
import { z } from 'astro/zod';

const verdi = <T extends z.ZodType>(inner: T) =>
  z.object({ verdi: inner, plassholder: z.boolean() });

export type Verdi<T = string> = { verdi: T; plassholder: boolean };

/** Prices in NOK incl. VAT. */
export const priserSchema = z.object({
  timepris: verdi(z.number()),
  servicebil: verdi(z.number()),
  forbruk: verdi(z.number()),
  varmtvannstankArbeid: verdi(z.number()),
  varmtvannstankTypiskTotal: verdi(z.number()),
  /** «Lekkasjesikker hytte»: fixed price on the work for a water stop valve on the cabin's main line. */
  hyttesikringArbeid: verdi(z.number()),
});

export const firmaSchema = z.object({
  navn: z.string(),
  juridiskNavn: z.string(),
  telefon: verdi(z.string()),
  whatsapp: verdi(z.string()),
  /** Show WhatsApp to customers (buttons, links and the reply-on-WhatsApp consent). Off: the site only offers phone and the form. */
  visWhatsapp: z.boolean(),
  epost: verdi(z.string()),
  orgnr: verdi(z.string()),
  adresse: verdi(z.string()),
  priser: priserSchema,
  omrade: z.object({
    steder: z.array(z.string()),
    maksKjoretidMin: verdi(z.number()),
  }),
});

export type Priser = z.infer<typeof priserSchema>;
export type Firma = z.infer<typeof firmaSchema>;

export async function getFirma(): Promise<Firma> {
  const { getEntry } = await import('astro:content');
  const entry = await getEntry('firma', 'firma');
  if (!entry) throw new Error('Missing firma entry in src/content/firma/firma.json');
  return firmaSchema.parse(entry.data);
}
