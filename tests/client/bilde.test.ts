// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { erHeic, forbered, harExif, lesBytes, maalStorrelse, MAKS_SIDE } from '../../src/client/skjema/bilde';

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const segment = (markor: number, innhold: number[]) => [0xff, markor, (innhold.length + 2) >> 8, (innhold.length + 2) & 0xff, ...innhold];

/** En liten JPEG-struktur med GPS-posisjon i Exif (APP1). */
function jpegMedGps(): Uint8Array<ArrayBuffer> {
  // TIFF (big endian): IFD0 med én oppføring, GPSInfo (0x8825), som peker på en GPS-IFD med breddegrad-ref «N».
  const tiff = [
    ...ascii('MM'), 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01, 0x88, 0x25, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x1a, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02, ...ascii('N'), 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ];
  return new Uint8Array([
    0xff, 0xd8,
    ...segment(0xe1, [...ascii('Exif'), 0, 0, ...tiff]),
    ...segment(0xdb, [0x00, ...new Array(64).fill(1)]),
    ...segment(0xda, [0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]),
    0x12, 0x34, 0x56,
    0xff, 0xd9,
  ]);
}

describe('maalStorrelse', () => {
  it('skalerer ned til maks 2000 px på lengste side og beholder forholdet', () => {
    expect(MAKS_SIDE).toBe(2000);
    expect(maalStorrelse(4032, 3024)).toEqual({ bredde: 2000, hoyde: 1500 });
    expect(maalStorrelse(3024, 4032)).toEqual({ bredde: 1500, hoyde: 2000 });
  });

  it('skalerer aldri opp', () => {
    expect(maalStorrelse(800, 600)).toEqual({ bredde: 800, hoyde: 600 });
  });
});

describe('harExif og erHeic', () => {
  it('finner Exif-markøren i APP1', () => {
    expect(harExif(jpegMedGps())).toBe(true);
    expect(harExif(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBe(false);
  });

  it('kjenner igjen HEIC på typen, filnavnet eller ftyp-merket', () => {
    const ftyp = new Uint8Array([0, 0, 0, 0x18, ...ascii('ftypheic')]);
    expect(erHeic(new File([], 'a.HEIC'), new Uint8Array())).toBe(true);
    expect(erHeic(new File([], 'a', { type: 'image/heic' }), new Uint8Array())).toBe(true);
    expect(erHeic(new File([], 'bilde'), ftyp)).toBe(true);
    expect(erHeic(new File([], 'a.jpg', { type: 'image/jpeg' }), jpegMedGps())).toBe(false);
  });
});

describe('forbered', () => {
  it('JPEG med GPS i Exif gir en blob uten Exif-markøren', async () => {
    const inn = jpegMedGps();
    expect(harExif(inn)).toBe(true);
    const ut = await forbered(new File([inn], 'bilde.jpg', { type: 'image/jpeg' }));
    const bytes = await lesBytes(ut);
    expect(ut.type).toBe('image/jpeg');
    expect(harExif(bytes)).toBe(false);
    expect(String.fromCharCode(...bytes)).not.toContain('Exif');
    // Bildedataene er med.
    expect([...bytes.subarray(-5)]).toEqual([0x12, 0x34, 0x56, 0xff, 0xd9]);
  });

  it('bruker canvas-tegningen når nettleseren har den, og fjerner Exif også derfra', async () => {
    const tegn = vi.fn(async () => new Blob([jpegMedGps()], { type: 'image/jpeg' }));
    const ut = await forbered(new File([jpegMedGps()], 'a.jpg', { type: 'image/jpeg' }), { tegn });
    expect(tegn).toHaveBeenCalledTimes(1);
    expect(harExif(await lesBytes(ut))).toBe(false);
  });

  it('HEIC gjøres om til JPEG bare når filen er HEIC', async () => {
    const heicTilJpeg = vi.fn(async () => new Blob([jpegMedGps()], { type: 'image/jpeg' }));
    const heic = new File([new Uint8Array([0, 0, 0, 0x18, ...ascii('ftypheic'), 1, 2, 3])], 'IMG_1.HEIC', { type: 'image/heic' });
    const ut = await forbered(heic, { heicTilJpeg });
    expect(heicTilJpeg).toHaveBeenCalledTimes(1);
    expect(ut.type).toBe('image/jpeg');
    expect(harExif(await lesBytes(ut))).toBe(false);

    heicTilJpeg.mockClear();
    await forbered(new File([jpegMedGps()], 'a.jpg', { type: 'image/jpeg' }), { heicTilJpeg });
    expect(heicTilJpeg).not.toHaveBeenCalled();
  });

  it('feiler HEIC-konverteringen, sendes originalen (serveren tar imot HEIC)', async () => {
    const heic = new File([new Uint8Array([0, 0, 0, 0x18, ...ascii('ftypheic')])], 'a.heic', { type: 'image/heic' });
    const ut = await forbered(heic, { heicTilJpeg: async () => Promise.reject(new Error('nei')) });
    expect(ut).toBe(heic);
  });
});
