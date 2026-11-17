// Fjerner metadata (særlig GPS-posisjon) fra bilder før de lagres (spesifikasjonen: «Posisjonsdata
// fjernes fra bildene»). Rene funksjoner uten avhengigheter; bildedataene kopieres uendret.
//
// - JPEG: APP1-segmenter (Exif og XMP) og APP13 (Photoshop/IPTC) fjernes. Resten, også selve
//   bildedataene etter SOS, kopieres byte for byte. Orienteringen i Exif forsvinner også; klienten
//   (oppgave 8) roterer og komprimerer bildet før opplasting.
// - PNG: tekst- og Exif-biter (eXIf, tEXt, iTXt, zTXt) fjernes.
// - HEIC og WebP endres ikke. Klienten (oppgave 8) gjør HEIC om til JPEG; kommer HEIC eller WebP
//   likevel rått inn (uten JavaScript), lagres det uendret og hendelsen
//   'bilde_metadata_ikke_fjernet' logges. Se docs/runbooks/nettside-eiersteg.md.

function slaaSammen(deler: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const ut = new Uint8Array(deler.reduce((n, d) => n + d.byteLength, 0));
  let pos = 0;
  for (const d of deler) {
    ut.set(d, pos);
    pos += d.byteLength;
  }
  return ut;
}

const APP1 = 0xe1;
const APP13 = 0xed;
const SOS = 0xda;
const EOI = 0xd9;

/** JPEG uten APP1/APP13, eller null når filen ikke er en JPEG vi kan lese. */
export function fjernJpegMetadata(b: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const deler: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    while (i < b.length && b[i] === 0xff) i++; // fyllbytes
    if (i >= b.length) return null;
    const markor = b[i];
    const start = i - 1;
    i++;
    if (markor === EOI) {
      deler.push(b.subarray(start, i));
      return slaaSammen(deler);
    }
    // Markører uten lengde (RST0–7, TEM).
    if ((markor >= 0xd0 && markor <= 0xd7) || markor === 0x01) {
      deler.push(b.subarray(start, i));
      continue;
    }
    if (i + 2 > b.length) return null;
    const lengde = (b[i] << 8) | b[i + 1];
    if (lengde < 2 || i + lengde > b.length) return null;
    const slutt = i + lengde;
    if (markor === SOS) {
      // Bildedataene og resten av filen kopieres uendret.
      deler.push(b.subarray(start));
      return slaaSammen(deler);
    }
    if (markor !== APP1 && markor !== APP13) deler.push(b.subarray(start, slutt));
    i = slutt;
  }
  return null;
}

const PNG_SIGNATUR = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_METADATA = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt']);

/** PNG uten Exif- og tekstbiter, eller null når filen ikke er en PNG vi kan lese. */
export function fjernPngMetadata(b: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (b.length < 8 || PNG_SIGNATUR.some((x, i) => b[i] !== x)) return null;
  const deler: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const lengde = ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
    const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    const slutt = i + 12 + lengde;
    if (slutt > b.length) return null;
    if (!PNG_METADATA.has(type)) deler.push(b.subarray(i, slutt));
    i = slutt;
    if (type === 'IEND') return slaaSammen(deler);
  }
  return null;
}
