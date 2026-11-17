// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { alleSporsmal, FELLES, HVOR_HORTE, samleSvar, sporsmalFor, valgNokkel } from '../../src/client/skjema/sporsmal';
import { tekstSchema } from '../../src/lib/innhold';
import { TJENESTER } from '../../src/server/validering';

const ider = (t: string, hast?: string) => sporsmalFor(t, { hast }).map((s) => s.id);

describe('sporsmalFor', () => {
  it('varmtvannstank: typeskilt, tanken, rom, etasje og stikkontakt eller fast tilkobling', () => {
    const s = sporsmalFor('varmtvannstank');
    const typeskilt = s.find((x) => x.id === 'bildeTypeskilt');
    expect(typeskilt).toMatchObject({ type: 'bilde', merke: 'typeskilt' });
    expect(s.find((x) => x.id === 'bildeTank')).toMatchObject({ type: 'bilde', merke: 'tank' });
    expect(ider('varmtvannstank')).toEqual(expect.arrayContaining(['rom', 'etasje', 'tilkobling']));
    expect(s.find((x) => x.id === 'tilkobling')?.valg).toEqual(expect.arrayContaining(['stikkontakt', 'fast']));
  });

  it('bad: mål, oppstart, egne håndverkere og styregodkjenning', () => {
    expect(ider('bad')).toEqual(expect.arrayContaining(['maal', 'oppstart', 'egneHandverkere', 'styregodkjenning']));
  });

  it('brønn: type, bilde av pumpe og trykktank (merke pumpe), symptom og vannprøve', () => {
    expect(ider('bronn-og-vann')).toEqual(expect.arrayContaining(['bronntype', 'bildePumpe', 'symptom', 'vannprove']));
    expect(sporsmalFor('bronn-og-vann').find((x) => x.id === 'bildePumpe')?.merke).toBe('pumpe');
  });

  it('service og reparasjon dekker lekkasje og tett avløp', () => {
    expect(ider('service-og-reparasjon')).toEqual(
      expect.arrayContaining(['problem', 'vannStengt', 'fukt', 'forsikringMeldt', 'antallAvlop']),
    );
  });

  it('«Det lekker nå» gir lekkasjespørsmålene uansett tjeneste', () => {
    expect(ider('bad')).not.toContain('vannStengt');
    expect(ider('bad', 'lekker-naa')).toEqual(expect.arrayContaining(['vannStengt', 'fukt', 'forsikringMeldt']));
  });

  it('har de felles spørsmålene for alle tjenester', () => {
    const felles = ['vann', 'avlop', 'byggear', 'adkomst', 'kontaktform'];
    expect(FELLES.map((s) => s.id)).toEqual(felles);
    for (const t of TJENESTER) expect(ider(t)).toEqual(expect.arrayContaining(felles));
  });

  it('har ingen dupliserte id-er, og id-ene passer API-ets nøkkelregel', () => {
    for (const t of TJENESTER) {
      const liste = ider(t, 'lekker-naa');
      expect(new Set(liste).size).toBe(liste.length);
      for (const id of liste) expect(id).toMatch(/^[A-Za-z0-9_-]{1,40}$/);
    }
  });

  it('ukjent tjeneste gir bare de felles spørsmålene', () => {
    expect(ider('finnes-ikke')).toEqual(FELLES.map((s) => s.id));
  });

  it('valg har etikettnøkler i camelCase, og «Hvor hørte du om oss?» har faste valg', () => {
    expect(valgNokkel('vet-ikke')).toBe('vetIkke');
    expect(valgNokkel('ja')).toBe('ja');
    expect(HVOR_HORTE.length).toBeGreaterThan(2);
    for (const v of HVOR_HORTE) expect(v).toMatch(/^[a-z0-9-]{1,40}$/);
  });
});

describe('etikettene i tekster', () => {
  it('har en etikett for hvert spørsmål og hvert valg, på begge språk', () => {
    for (const loc of ['nb', 'en']) {
      const t = tekstSchema.parse(JSON.parse(readFileSync(`src/content/tekster/${loc}.json`, 'utf8'))).skjema;
      const sporsmal = alleSporsmal().map((x) => x.sporsmal);
      for (const s of [...sporsmal, ...FELLES]) {
        expect(t.sporsmal, `${loc}: ${s.id}`).toHaveProperty(s.id);
        for (const v of s.valg ?? []) expect(t.valg, `${loc}: ${v}`).toHaveProperty(valgNokkel(v));
      }
      for (const v of HVOR_HORTE) expect(t.hvorHorteValg, `${loc}: ${v}`).toHaveProperty(valgNokkel(v));
      // Ingen etiketter uten spørsmål.
      expect(Object.keys(t.sporsmal).sort()).toEqual([...new Set([...sporsmal, ...FELLES].map((s) => s.id))].sort());
    }
  });
});

describe('samleSvar', () => {
  it('fordeler svarene på felles og tjenesteSvar, og hopper over tomme og skjulte', () => {
    document.body.innerHTML = `
      <form>
        <input type="radio" name="sp-vann" value="bronn" checked />
        <input name="sp-byggear" value="1975" />
        <input name="sp-adkomst" value="" />
        <input type="radio" name="sp-tilkobling" value="fast" checked />
        <input name="sp-rom" value="Kjeller" />
      </form>`;
    const form = document.querySelector('form')!;
    const svar = samleSvar(form, sporsmalFor('varmtvannstank'));
    expect(svar).toEqual({ felles: { vann: 'bronn', byggear: '1975' }, tjenesteSvar: { tilkobling: 'fast', rom: 'Kjeller' } });
  });

  it('tar bare med oppfølgingsspørsmål når valget de hører til er gjort', () => {
    document.body.innerHTML = `<form>
      <input type="radio" name="sp-problem" value="tett-avlop" checked />
      <input type="radio" name="sp-vannStengt" value="ja" checked />
      <input type="radio" name="sp-antallAvlop" value="flere" checked />
    </form>`;
    const form = document.querySelector('form')!;
    expect(samleSvar(form, sporsmalFor('service-og-reparasjon')).tjenesteSvar).toEqual({ problem: 'tett-avlop', antallAvlop: 'flere' });
    // Lekker det nå, gjelder lekkasjespørsmålene uansett.
    expect(samleSvar(form, sporsmalFor('service-og-reparasjon', { hast: 'lekker-naa' })).tjenesteSvar).toEqual({
      problem: 'tett-avlop',
      vannStengt: 'ja',
      antallAvlop: 'flere',
    });
  });

  it('tar ikke med svar på spørsmål som ikke gjelder tjenesten', () => {
    document.body.innerHTML = `<form><input name="sp-rom" value="Kjeller" /><input name="sp-maal" value="2x3" /></form>`;
    const svar = samleSvar(document.querySelector('form')!, sporsmalFor('bad'));
    expect(svar.tjenesteSvar).toEqual({ maal: '2x3' });
  });
});
