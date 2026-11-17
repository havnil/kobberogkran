// Klargjøring av bilder før opplasting (spesifikasjonen: «Bildene komprimeres og HEIC-format
// håndteres. Posisjonsdata fjernes fra bildene.»).
//
// `forbered(fil)`:
// 1. HEIC (iPhone) gjøres om til JPEG med `heic2any`, som lastes (dynamisk import) bare når filen er HEIC.
// 2. Bildet tegnes på nytt i et canvas: `createImageBitmap` med `imageOrientation: 'from-image'`
//    snur bildet riktig etter Exif-orienteringen, det skaleres til maks 2000 px på lengste side, og
//    kodes om som JPEG (kvalitet 0,85). Et omkodet canvasbilde har ingen metadata, altså ingen GPS.
// 3. Har nettleseren ikke canvas eller `createImageBitmap` (eller feiler tegningen), fjernes
//    metadata direkte i bytene (samme funksjon som serveren bruker), og bildet sendes i full størrelse.
//    Til slutt sjekkes alltid at en JPEG ikke har Exif igjen.
//
// Canvas-veien finnes ikke i jsdom. Testene dekker regnestykket, Exif-sjekken, HEIC-valget og
// reserveveien; canvas-veien sjekkes manuelt i nettleseren (se rapporten for oppgave 8).
import { fjernJpegMetadata, fjernPngMetadata } from '../../server/bildemetadata';

export const MAKS_SIDE = 2000;
export const JPEG_KVALITET = 0.85;

/** Størrelsen etter nedskalering til maks `maks` px på lengste side. Skalerer aldri opp. */
export function maalStorrelse(bredde: number, hoyde: number, maks = MAKS_SIDE): { bredde: number; hoyde: number } {
  const skala = Math.min(1, maks / Math.max(bredde, hoyde));
  return { bredde: Math.max(1, Math.round(bredde * skala)), hoyde: Math.max(1, Math.round(hoyde * skala)) };
}

/** Har JPEG-en et APP1-segment med Exif (`Exif\0\0`) før bildedataene? */
export function harExif(b: Uint8Array): boolean {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return false;
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const markor = b[i + 1];
    if (markor === 0xda || markor === 0xd9) return false;
    const lengde = (b[i + 2] << 8) | b[i + 3];
    if (markor === 0xe1 && i + 10 <= b.length) {
      const id = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7], b[i + 8], b[i + 9]);
      if (id === 'Exif\0\0') return true;
    }
    if (lengde < 2) return false;
    i += 2 + lengde;
  }
  return false;
}

const HEIF_MERKER = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'];

/** HEIC/HEIF ut fra typen, filendelsen eller `ftyp`-merket i de første bytene. */
export function erHeic(fil: File, forste: Uint8Array): boolean {
  if (/^image\/hei[cf]/i.test(fil.type) || /\.hei[cf]$/i.test(fil.name)) return true;
  if (forste.length < 12) return false;
  const ascii = (fra: number, til: number) => String.fromCharCode(...forste.subarray(fra, til));
  return ascii(4, 8) === 'ftyp' && HEIF_MERKER.includes(ascii(8, 12));
}

/** Bytene i en blob. jsdom og eldre nettlesere mangler `Blob.arrayBuffer`, så FileReader er reserven. */
export async function lesBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  return new Promise((ok, feil) => {
    const r = new FileReader();
    r.onload = () => ok(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => feil(r.error);
    r.readAsArrayBuffer(blob);
  });
}

async function heic2anyTilJpeg(blob: Blob): Promise<Blob> {
  const { default: heic2any } = await import('heic2any');
  const ut = await heic2any({ blob, toType: 'image/jpeg', quality: 0.9 });
  return Array.isArray(ut) ? ut[0] : ut;
}

/** Tegner bildet på nytt: riktig vei opp, maks 2000 px, JPEG. Kaster når nettleseren ikke kan det. */
export async function tegnPaaNytt(blob: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap mangler');
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  try {
    const { bredde, hoyde } = maalStorrelse(bitmap.width, bitmap.height);
    if (typeof OffscreenCanvas === 'function') {
      const c = new OffscreenCanvas(bredde, hoyde);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('canvas mangler');
      ctx.drawImage(bitmap, 0, 0, bredde, hoyde);
      return await c.convertToBlob({ type: 'image/jpeg', quality: JPEG_KVALITET });
    }
    const c = document.createElement('canvas');
    c.width = bredde;
    c.height = hoyde;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('canvas mangler');
    ctx.drawImage(bitmap, 0, 0, bredde, hoyde);
    return await new Promise<Blob>((ok, feil) =>
      c.toBlob((b) => (b ? ok(b) : feil(new Error('toBlob ga null'))), 'image/jpeg', JPEG_KVALITET),
    );
  } finally {
    bitmap.close();
  }
}

export interface ForberedDeps {
  /** Canvas-tegningen. Standard: `tegnPaaNytt`. */
  tegn?: (blob: Blob) => Promise<Blob>;
  /** HEIC → JPEG. Standard: `heic2any` (dynamisk import). */
  heicTilJpeg?: (blob: Blob) => Promise<Blob>;
}

/** Fjerner metadata i bytene for JPEG og PNG; andre typer returneres uendret. */
async function utenMetadata(blob: Blob): Promise<Blob> {
  const bytes = await lesBytes(blob);
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  const renset = jpeg ? fjernJpegMetadata(bytes) : png ? fjernPngMetadata(bytes) : null;
  if (!renset) return blob;
  return new Blob([renset], { type: jpeg ? 'image/jpeg' : 'image/png' });
}

/**
 * Klargjør et bilde for opplasting: HEIC → JPEG, riktig vei opp, maks 2000 px, uten metadata.
 * Kan HEIC ikke gjøres om, returneres originalfilen (serveren tar imot HEIC og logger at metadata ikke
 * er fjernet).
 */
export async function forbered(fil: File, deps: ForberedDeps = {}): Promise<Blob> {
  const tegn = deps.tegn ?? tegnPaaNytt;
  const heicTilJpeg = deps.heicTilJpeg ?? heic2anyTilJpeg;
  const forste = await lesBytes(fil.slice(0, 16));

  let kilde: Blob = fil;
  if (erHeic(fil, forste)) {
    try {
      kilde = await heicTilJpeg(fil);
    } catch {
      return fil;
    }
  }

  let ut: Blob;
  try {
    ut = await tegn(kilde);
  } catch {
    // Ingen canvas: fjern metadata i bytene i stedet (full størrelse).
    return utenMetadata(kilde);
  }
  // Et omkodet canvasbilde har ingen Exif, men sjekken er billig.
  return harExif(await lesBytes(ut.slice(0, 64 * 1024))) ? utenMetadata(ut) : ut;
}
