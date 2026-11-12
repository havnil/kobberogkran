import { describe, expect, it } from 'vitest';
import { delKvittering, sendBilderLenke, SIDER } from '../../src/lib/skjemaSider';

describe('sendBilderLenke', () => {
  it('bygger lenken til send-bilder-siden per språk', () => {
    expect(sendBilderLenke('https://kobberogkran.no', 'nb', 'a b', 'f'.repeat(64))).toBe(
      `https://kobberogkran.no/send-bilder/?id=a%20b&token=${'f'.repeat(64)}`,
    );
    expect(sendBilderLenke('https://x.test/', 'en', 'id1', 't')).toBe('https://x.test/en/send-photos/?id=id1&token=t');
    expect(SIDER.sendBilder.en).toBe('/en/send-photos/');
  });
});

describe('delKvittering', () => {
  it('deler malen der {sendBilderLenke} står, og fjerner andre variabler', () => {
    expect(delKvittering('Takk! Send bilder her: {sendBilderLenke} {ukjent}Hilsen')).toEqual({
      for: 'Takk! Send bilder her: ',
      etter: ' Hilsen',
      harLenke: true,
    });
  });

  it('uten {sendBilderLenke} gir hele teksten og harLenke false', () => {
    expect(delKvittering('Takk, vi har mottatt forespørselen din. {navn}')).toEqual({
      for: 'Takk, vi har mottatt forespørselen din.',
      etter: '',
      harLenke: false,
    });
  });
});
