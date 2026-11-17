import { describe, expect, it } from 'vitest';
import { signerBildeLenke, verifiserBildeLenke } from '../../src/server/bildelenke';

const hemmelig = 'test-hemmelighet';
const naa = 1_800_000_000;

const del = (lenke: string) => {
  const m = /^\/api\/bilde\/([^?]+)\?utloper=(\d+)&sig=([0-9a-f]{64})$/.exec(lenke);
  expect(m).not.toBeNull();
  return { id: decodeURIComponent(m![1]), utloper: Number(m![2]), sig: m![3] };
};

describe('signerBildeLenke', () => {
  it('lager sti med utløp og hex-signatur', async () => {
    const lenke = await signerBildeLenke('bilde-1', hemmelig, naa + 3600);
    const { id, utloper } = del(lenke);
    expect(id).toBe('bilde-1');
    expect(utloper).toBe(naa + 3600);
  });

  it('er deterministisk', async () => {
    expect(await signerBildeLenke('b', hemmelig, naa)).toBe(await signerBildeLenke('b', hemmelig, naa));
  });

  it('URL-koder bilde-id', async () => {
    const lenke = await signerBildeLenke('a/b c', hemmelig, naa + 1);
    expect(lenke.startsWith('/api/bilde/a%2Fb%20c?')).toBe(true);
  });
});

describe('verifiserBildeLenke', () => {
  it('godtar gyldig lenke før utløp', async () => {
    const { id, utloper, sig } = del(await signerBildeLenke('bilde-1', hemmelig, naa + 60));
    expect(await verifiserBildeLenke(id, utloper, sig, hemmelig, naa)).toBe(true);
  });

  it('avviser utløpt lenke', async () => {
    const { id, utloper, sig } = del(await signerBildeLenke('bilde-1', hemmelig, naa - 1));
    expect(await verifiserBildeLenke(id, utloper, sig, hemmelig, naa)).toBe(false);
  });

  it('avviser endret bilde-id, endret utløp, feil hemmelighet og tuklet signatur', async () => {
    const { id, utloper, sig } = del(await signerBildeLenke('bilde-1', hemmelig, naa + 60));
    expect(await verifiserBildeLenke('bilde-2', utloper, sig, hemmelig, naa)).toBe(false);
    expect(await verifiserBildeLenke(id, utloper + 1, sig, hemmelig, naa)).toBe(false);
    expect(await verifiserBildeLenke(id, utloper, sig, 'annen', naa)).toBe(false);
    const tuklet = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
    expect(await verifiserBildeLenke(id, utloper, tuklet, hemmelig, naa)).toBe(false);
  });

  it('avviser ugyldig format uten å kaste', async () => {
    expect(await verifiserBildeLenke('b', naa + 60, 'ikke-hex', hemmelig, naa)).toBe(false);
    expect(await verifiserBildeLenke('b', naa + 60, 'ab', hemmelig, naa)).toBe(false);
    expect(await verifiserBildeLenke('b', Number.NaN, 'a'.repeat(64), hemmelig, naa)).toBe(false);
    expect(await verifiserBildeLenke('b', naa + 60, 'a'.repeat(64), '', naa)).toBe(false);
  });
});
