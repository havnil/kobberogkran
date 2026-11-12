// Faste regler for sortering av forespørsler. Rene funksjoner; ingen nettverk.
// Resultatet går bare til Eirik (i varselet og som grunnlag for AI-sammendraget).
import firmaJson from '../../content/firma/firma.json';
import { firmaSchema, type Firma } from '../../lib/firma';
import { regneeksempel } from '../../lib/priser';
import type { Foresporsel } from '../db';

/** Hemnes sentrum. */
export const HEMNES = { lat: 59.9497, lon: 11.4686 } as const;
/** Veien er lengre enn luftlinjen. */
const VEIFAKTOR = 1.4;
const SNITTFART_KMT = 60;

let firmaCache: Firma | undefined;
/** Firmadata, validert én gang. Importeres direkte (ingen serialisering ved bygging). */
export function firma(): Firma {
  firmaCache ??= firmaSchema.parse(firmaJson.firma);
  return firmaCache;
}

function luftlinjeKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Omtrentlig kjøretid i minutter fra Hemnes sentrum: luftlinje × 1,4 ved 60 km/t, avrundet.
 * Uten begge koordinatene gir den `null` («ukjent»), f.eks. for hytte med bare gårds- og bruksnummer.
 */
export function kjoretidMin(lat?: number | null, lon?: number | null): number | null {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const km = luftlinjeKm(HEMNES.lat, HEMNES.lon, lat, lon) * VEIFAKTOR;
  return Math.round((km / SNITTFART_KMT) * 60);
}

/** Treff med venstre ordgrense som også virker for æ, ø og å (\b gjør ikke det). */
const ord = (monster: string) => new RegExp(`(?<!\\p{L})(?:${monster})`, 'iu');

/** Røde flagg fra spesifikasjonen. Nøkkelen er teksten Eirik ser. */
const RODE_FLAGG: [string, RegExp][] = [
  ['kjøpt delene selv', ord('kjøpt\\s+(?:delene|deler|utstyret|materiell(?:et)?|tanken)\\s+selv')],
  ['bare montere', ord('bare\\s+(?:montere|montering|monter|koble\\s+til)')],
  ['billigst', ord('billigst')],
  [
    'en annen har begynt',
    ord('annen\\s+(?:rørlegger\\s+|håndverker\\s+)?har\\s+(?:begynt|startet|påbegynt)|påbegynt\\s+av\\s+(?:en\\s+)?annen'),
  ],
  ['kontant', ord('kontant')],
];

/** Jobber Eirik ikke tar. */
const IKKE_VAAR_JOBB: [string, RegExp][] = [
  ['elektro', ord('elektr(?:iker|o)|sikringsskap|jordfeil|el-?arbeid')],
  ['spyling', ord('spyl|høytrykk|slamsug|sugebil')],
];

export interface Regelsjekk {
  /** null når kjøretiden er ukjent. */
  utenforOmrade: boolean | null;
  rodeFlagg: string[];
  /** Koder: `beskrivelse`, `sted`, `typeskilt`, `tankbilde`, `pumpebilde`. */
  mangler: string[];
  ikkeVaarJobb: string[];
  /** NOK inkl. mva, før deler. null når prislisten ikke gir et anslag (bad, annet). */
  prisanslag: { fra: number; til: number } | null;
}

/** All fritekst kunden har skrevet: beskrivelsen og strengverdiene i svarene (ikke bildeMerker). */
function fritekst(f: Foresporsel): string {
  const deler: string[] = [];
  if (f.beskrivelse) deler.push(f.beskrivelse);
  const samle = (v: unknown): void => {
    if (typeof v === 'string') deler.push(v);
    else if (Array.isArray(v)) v.forEach(samle);
    else if (v && typeof v === 'object') Object.values(v).forEach(samle);
  };
  if (f.svar) {
    const { bildeMerker: _ignorert, ...resten } = f.svar;
    samle(resten);
  }
  return deler.join('\n');
}

/** Hva er det bilde av? Bare merker med minst ett lagret bilde teller. */
function harBilde(f: Foresporsel, merke: string): boolean {
  const merker = Array.isArray(f.svar?.bildeMerker) ? f.svar.bildeMerker : [];
  return f.bilder.length > 0 && merker.includes(merke);
}

function prisanslag(tjeneste: string): { fra: number; til: number } | null {
  const p = firma().priser;
  switch (tjeneste) {
    case 'service-og-reparasjon':
    case 'bronn-og-vann':
    case 'hytte':
      // Timearbeid: regneeksempelet for 1–2 timer, pluss deler.
      return { fra: regneeksempel(p, 1), til: regneeksempel(p, 2) };
    case 'varmtvannstank':
      // Fastpris for arbeidet, opp til typisk total med tank.
      return { fra: p.varmtvannstankArbeid.verdi, til: p.varmtvannstankTypiskTotal.verdi };
    default:
      // bad: ingen pris (spesifikasjonen). annet: ukjent jobb.
      return null;
  }
}

export function regelsjekk(f: Foresporsel): Regelsjekk {
  const kjoretid = f.kjoretidMin ?? kjoretidMin(f.lat, f.lon);
  const utenforOmrade = kjoretid == null ? null : kjoretid > firma().omrade.maksKjoretidMin.verdi;

  const tekst = fritekst(f);
  const rodeFlagg = RODE_FLAGG.filter(([, m]) => m.test(tekst)).map(([navn]) => navn);
  const ikkeVaarJobb = IKKE_VAAR_JOBB.filter(([, m]) => m.test(tekst)).map(([navn]) => navn);

  const mangler: string[] = [];
  if (!f.beskrivelse?.trim()) mangler.push('beskrivelse');
  if (!f.stedTekst?.trim() && (f.lat == null || f.lon == null)) mangler.push('sted');
  if (f.tjeneste === 'varmtvannstank') {
    if (!harBilde(f, 'typeskilt')) mangler.push('typeskilt');
    if (!harBilde(f, 'tank')) mangler.push('tankbilde');
  }
  if (f.tjeneste === 'bronn-og-vann' && !harBilde(f, 'pumpe')) mangler.push('pumpebilde');

  return { utenforOmrade, rodeFlagg, mangler, ikkeVaarJobb, prisanslag: prisanslag(f.tjeneste) };
}
