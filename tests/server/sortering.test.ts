import { describe, expect, it, vi } from 'vitest';
import type { Foresporsel } from '../../src/server/db';
import { kjoretidMin, regelsjekk } from '../../src/server/sortering/regler';
import { ClaudeSorterer, FalskSorterer, lagBrukermelding } from '../../src/server/sortering/ai';

const foresporsel = (over: Partial<Foresporsel> = {}): Foresporsel => ({
  id: 'f1',
  tjeneste: 'service-og-reparasjon',
  hast: 'snart',
  stedTekst: 'Storgata 1, Bjørkelangen',
  lat: 59.885,
  lon: 11.567,
  kjoretidMin: null,
  beskrivelse: 'Kranen på badet drypper.',
  svar: null,
  kilde: null,
  status: 'ny',
  opprettet: '2026-11-12T10:00:00.000Z',
  kunde: { navn: 'Kari Kunde', telefon: '+4791234567', epost: 'kari@example.no' },
  bilder: [],
  ...over,
});

describe('kjoretidMin', () => {
  it('Lillestrøm gir mellom 25 og 45 minutter', () => {
    const min = kjoretidMin(59.956, 11.0492);
    expect(min).not.toBeNull();
    expect(min!).toBeGreaterThanOrEqual(25);
    expect(min!).toBeLessThanOrEqual(45);
  });

  it('Hemnes sentrum gir 0', () => {
    expect(kjoretidMin(59.9497, 11.4686)).toBe(0);
  });

  it('gir et heltall', () => {
    expect(Number.isInteger(kjoretidMin(60.1, 11.2))).toBe(true);
  });

  it('uten koordinater gir null', () => {
    expect(kjoretidMin(undefined, undefined)).toBeNull();
    expect(kjoretidMin(null, null)).toBeNull();
    expect(kjoretidMin(59.9, undefined)).toBeNull();
  });
});

describe('regelsjekk', () => {
  it('«har kjøpt delene selv» gir rødt flagg', () => {
    const r = regelsjekk(foresporsel({ beskrivelse: 'Jeg har kjøpt delene selv, trenger bare hjelp.' }));
    expect(r.rodeFlagg.length).toBeGreaterThan(0);
    expect(r.rodeFlagg).toContain('kjøpt delene selv');
  });

  it('finner alle røde flagg fra spesifikasjonen, uavhengig av store bokstaver', () => {
    const r = regelsjekk(
      foresporsel({
        beskrivelse: 'Skal BARE MONTERE en ny tank. Hva er billigst? En annen har begynt på jobben. Kan betale kontant.',
      }),
    );
    expect(r.rodeFlagg).toEqual(
      expect.arrayContaining(['bare montere', 'billigst', 'en annen har begynt', 'kontant']),
    );
  });

  it('finner røde flagg i fritekst i svarene', () => {
    const r = regelsjekk(foresporsel({ beskrivelse: null, svar: { felles: { adkomst: 'Betaler gjerne kontant' } } }));
    expect(r.rodeFlagg).toContain('kontant');
  });

  it('vanlig beskrivelse gir ingen røde flagg', () => {
    expect(regelsjekk(foresporsel()).rodeFlagg).toEqual([]);
  });

  it('varmtvannstank uten bilde av typeskiltet gir mangler typeskilt', () => {
    const r = regelsjekk(foresporsel({ tjeneste: 'varmtvannstank' }));
    expect(r.mangler).toContain('typeskilt');
  });

  it('varmtvannstank med bilde merket typeskilt mangler ikke typeskilt', () => {
    const r = regelsjekk(
      foresporsel({
        tjeneste: 'varmtvannstank',
        svar: { bildeMerker: ['typeskilt', 'tank'] },
        bilder: [{ id: 'b1', r2Nokkel: 'a.jpg' }, { id: 'b2', r2Nokkel: 'b.jpg' }],
      }),
    );
    expect(r.mangler).not.toContain('typeskilt');
    expect(r.mangler).not.toContain('tankbilde');
  });

  it('brønn uten bilde av pumpen gir mangler pumpebilde', () => {
    expect(regelsjekk(foresporsel({ tjeneste: 'bronn-og-vann' })).mangler).toContain('pumpebilde');
  });

  it('manglende beskrivelse og sted gir mangler', () => {
    const r = regelsjekk(foresporsel({ beskrivelse: '  ', stedTekst: null, lat: null, lon: null }));
    expect(r.mangler).toEqual(expect.arrayContaining(['beskrivelse', 'sted']));
  });

  it('elektro og spyling er ikke vår jobb', () => {
    const r = regelsjekk(
      foresporsel({ beskrivelse: 'Trenger elektriker til sikringsskapet, og avløpet må spyles med høytrykk.' }),
    );
    expect(r.ikkeVaarJobb).toEqual(expect.arrayContaining(['elektro', 'spyling']));
  });

  it('vanlig rørleggerjobb er vår jobb', () => {
    expect(regelsjekk(foresporsel()).ikkeVaarJobb).toEqual([]);
  });

  it('utenforOmrade er null uten koordinater og kjøretid (hytte uten adresse)', () => {
    const r = regelsjekk(foresporsel({ stedTekst: 'Gnr 12 bnr 3, Setskog', lat: null, lon: null }));
    expect(r.utenforOmrade).toBeNull();
  });

  it('utenforOmrade er false nær Hemnes og true langt unna', () => {
    expect(regelsjekk(foresporsel()).utenforOmrade).toBe(false);
    // Trondheim
    expect(regelsjekk(foresporsel({ lat: 63.43, lon: 10.39 })).utenforOmrade).toBe(true);
  });

  it('bruker lagret kjøretid når den finnes', () => {
    expect(regelsjekk(foresporsel({ lat: null, lon: null, kjoretidMin: 90 })).utenforOmrade).toBe(true);
  });

  it('prisanslag: service gir regneeksempelet for 1–2 timer', () => {
    // 1 125 timepris + 625 servicebil + 125 forbruk
    expect(regelsjekk(foresporsel()).prisanslag).toEqual({ fra: 1875, til: 3000 });
  });

  it('prisanslag: varmtvannstank gir fastpris for arbeid og typisk total', () => {
    expect(regelsjekk(foresporsel({ tjeneste: 'varmtvannstank' })).prisanslag).toEqual({ fra: 8125, til: 18000 });
  });

  it('prisanslag: bad og annet gir null', () => {
    expect(regelsjekk(foresporsel({ tjeneste: 'bad' })).prisanslag).toBeNull();
    expect(regelsjekk(foresporsel({ tjeneste: 'annet' })).prisanslag).toBeNull();
  });
});

describe('lagBrukermelding', () => {
  it('sender aldri telefon, e-post eller navn til modellen', () => {
    const f = foresporsel({ svar: { felles: { vann: 'brønn' } } });
    const tekst = lagBrukermelding(f, regelsjekk(f));
    expect(tekst).not.toContain('+4791234567');
    expect(tekst).not.toContain('91234567');
    expect(tekst).not.toContain('kari@example.no');
    expect(tekst).not.toContain('Kari');
    expect(tekst).toContain('service-og-reparasjon');
    expect(tekst).toContain('Kranen på badet drypper.');
    expect(tekst).toContain('brønn');
  });
});

const svarFraApi = (innhold: unknown, over: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-5-5',
      stop_reason: 'end_turn',
      content: [
        { type: 'thinking', thinking: '', signature: 'x' },
        { type: 'text', text: JSON.stringify(innhold) },
      ],
      ...over,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const gyldig = { sammendrag: 'Dryppende kran på bad.', hast: 'snart', svarutkast: 'Hei, takk for meldingen.' };

describe('ClaudeSorterer', () => {
  it('sender riktig forespørsel til Messages API', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => svarFraApi(gyldig));
    const s = new ClaudeSorterer('test-nokkel', { fetch: fetchMock as unknown as typeof fetch });
    const f = foresporsel();
    const res = await s.sorter(f, regelsjekk(f));
    expect(res).toEqual(gyldig);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('x-api-key')).toBe('test-nokkel');
    expect(headers.get('anthropic-version')).toBe('2026-10-21');
    expect(headers.get('content-type')).toBe('application/json');
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe('claude-haiku-5-5');
    expect(body.max_tokens).toBeGreaterThan(0);
    expect(body.temperature).toBeUndefined();
    expect(typeof body.system).toBe('string');
    expect(body.system).toMatch(/Eirik/);
    expect(body.system).toMatch(/utkast/i);
    expect(body.output_config.format.type).toBe('json_schema');
    const schema = body.output_config.format.schema;
    expect(schema.required).toEqual(expect.arrayContaining(['sammendrag', 'hast', 'svarutkast']));
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.hast.enum).toEqual(['akutt', 'snart', 'planlegges']);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
    const sendt = JSON.stringify(body);
    expect(sendt).not.toContain('91234567');
    expect(sendt).not.toContain('kari@example.no');
  });

  it('kaster ved HTTP-feil', async () => {
    const fetchMock = vi.fn(async () => new Response('{"type":"error"}', { status: 529 }));
    const s = new ClaudeSorterer('k', { fetch: fetchMock as unknown as typeof fetch });
    const f = foresporsel();
    await expect(s.sorter(f, regelsjekk(f))).rejects.toThrow(/529/);
  });

  it('kaster når svaret ikke følger skjemaet', async () => {
    const fetchMock = vi.fn(async () => svarFraApi({ sammendrag: 'x', hast: 'i går', svarutkast: 'y' }));
    const s = new ClaudeSorterer('k', { fetch: fetchMock as unknown as typeof fetch });
    const f = foresporsel();
    await expect(s.sorter(f, regelsjekk(f))).rejects.toThrow();
  });

  it('kaster ved stop_reason som ikke er end_turn', async () => {
    const fetchMock = vi.fn(async () => svarFraApi(gyldig, { stop_reason: 'refusal' }));
    const s = new ClaudeSorterer('k', { fetch: fetchMock as unknown as typeof fetch });
    const f = foresporsel();
    await expect(s.sorter(f, regelsjekk(f))).rejects.toThrow(/refusal/);
  });

  it('avbryter etter tidsavbrudd', async () => {
    const fetchMock = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_, avvis) => {
          init?.signal?.addEventListener('abort', () => avvis(new DOMException('Avbrutt', 'AbortError')));
        }),
    );
    const s = new ClaudeSorterer('k', { fetch: fetchMock as unknown as typeof fetch, tidsavbruddMs: 20 });
    const f = foresporsel();
    await expect(s.sorter(f, regelsjekk(f))).rejects.toThrow();
  });

  it('kaster uten API-nøkkel uten å kalle fetch', async () => {
    const fetchMock = vi.fn();
    const s = new ClaudeSorterer(undefined, { fetch: fetchMock as unknown as typeof fetch });
    const f = foresporsel();
    await expect(s.sorter(f, regelsjekk(f))).rejects.toThrow(/ANTHROPIC_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('FalskSorterer', () => {
  it('gir fast resultat', async () => {
    const f = foresporsel();
    await expect(new FalskSorterer(gyldig as never).sorter(f, regelsjekk(f))).resolves.toEqual(gyldig);
  });

  it('kaster gitt feil', async () => {
    const f = foresporsel();
    await expect(new FalskSorterer(new Error('nede')).sorter(f, regelsjekk(f))).rejects.toThrow('nede');
  });
});
