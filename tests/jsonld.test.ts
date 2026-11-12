import { describe, expect, it } from 'vitest';
import { breadcrumbJsonLd, faqJsonLd, orgJsonLd, serviceJsonLd } from '../src/lib/jsonld';
import type { Firma } from '../src/lib/firma';
import type { Tjeneste } from '../src/lib/innhold';

const ph = (verdi: string) => ({ verdi, plassholder: true });
const ekte = (verdi: string) => ({ verdi, plassholder: false });
const tall = (verdi: number) => ({ verdi, plassholder: true });

const firma: Firma = {
  navn: 'Kobber og Kran',
  juridiskNavn: 'Kobber og Kran AS',
  telefon: ph('000 00 000'),
  whatsapp: ph('+4700000000'),
  epost: ekte('post@example.no'),
  orgnr: ekte('123 456 789'),
  adresse: ph('Hemnes, 1970 Hemnes'),
  priser: {
    timepris: tall(1), servicebil: tall(1), forbruk: tall(1), varmtvannstankArbeid: tall(1), varmtvannstankTypiskTotal: tall(1),
  },
  omrade: { steder: ['Hemnes', 'Aurskog'], maksKjoretidMin: tall(45) },
};

const tjeneste: Tjeneste = {
  title: 'Varmtvannstank',
  kundeTittel: 'Ny tank',
  fagord: 'Bytte av bereder',
  nummer: 2,
  kort: 'PLASSHOLDER: kort',
  fakta: [],
  faq: [],
  bilder: [],
  translationKey: 'varmtvannstank',
  locale: 'nb',
};

describe('orgJsonLd', () => {
  const org = orgJsonLd(firma, 'nb') as Record<string, unknown>;

  it('is a Plumber with the fixed @id and no aggregateRating', () => {
    expect(org['@type']).toBe('Plumber');
    expect(org['@id']).toBe('https://kobberogkran.no/#firma');
    expect(org).not.toHaveProperty('aggregateRating');
    expect(org.name).toBe('Kobber og Kran AS');
  });

  it('omits fields whose value is a placeholder', () => {
    expect(org).not.toHaveProperty('telephone');
    expect(org).not.toHaveProperty('address');
  });

  it('includes real fields and the places served', () => {
    expect(org.email).toBe('post@example.no');
    expect(org.vatID).toBe('NO123456789MVA');
    expect(org.areaServed).toEqual(['Hemnes', 'Aurskog']);
  });

  it('includes telephone once it is real', () => {
    const real = orgJsonLd({ ...firma, telefon: ekte('900 00 000') }, 'nb') as Record<string, unknown>;
    expect(real.telephone).toBe('900 00 000');
  });
});

describe('serviceJsonLd', () => {
  it('omits placeholder text and points at the firm', () => {
    const s = serviceJsonLd(tjeneste, 'https://kobberogkran.no/tjenester/varmtvannstank/') as Record<string, unknown>;
    expect(s['@type']).toBe('Service');
    expect(s.name).toBe('Varmtvannstank');
    expect(s).not.toHaveProperty('description');
    expect(s.provider).toEqual({ '@id': 'https://kobberogkran.no/#firma' });
    expect(s.url).toBe('https://kobberogkran.no/tjenester/varmtvannstank/');
  });
});

describe('breadcrumbJsonLd', () => {
  it('numbers the items from 1', () => {
    const b = breadcrumbJsonLd([
      { name: 'Hjem', url: 'https://kobberogkran.no/' },
      { name: 'Tjenester', url: 'https://kobberogkran.no/tjenester/' },
    ]) as { itemListElement: { position: number; name: string; item: string }[] };
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(b.itemListElement[1]).toMatchObject({ name: 'Tjenester', item: 'https://kobberogkran.no/tjenester/' });
  });
});

describe('faqJsonLd', () => {
  it('returns null with 0 questions', () => {
    expect(faqJsonLd([])).toBeNull();
  });

  it('returns null when all questions are placeholders', () => {
    expect(faqJsonLd([{ sporsmal: 'PLASSHOLDER: Spørsmål', svar: 'PLASSHOLDER: Svar' }])).toBeNull();
  });

  it('mirrors real questions as FAQPage', () => {
    const f = faqJsonLd([{ sporsmal: 'Hvor lang tid?', svar: 'En dag.' }]) as { '@type': string; mainEntity: unknown[] };
    expect(f['@type']).toBe('FAQPage');
    expect(f.mainEntity).toEqual([
      { '@type': 'Question', name: 'Hvor lang tid?', acceptedAnswer: { '@type': 'Answer', text: 'En dag.' } },
    ]);
  });
});
