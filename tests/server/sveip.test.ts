// Sveip etter forespørsler uten varsel (Cron Trigger, se docs/runbooks/nettside-eiersteg.md).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import type { Miniflare } from 'miniflare';
import { startD1, nullstill } from './d1';
import { hentForesporsel, opprettForesporsel, settStatus } from '../../src/server/db';
import type { Env } from '../../src/server/env';
import { FalskSorterer } from '../../src/server/sortering/ai';
import { sveipUvarslede, SVEIP_ALDER_MS } from '../../src/server/sveip';
import type { Varsler } from '../../src/server/varsling';

vi.setConfig({ testTimeout: 30_000 });

let mf: Miniflare;
let db: D1Database;

beforeAll(async () => {
  ({ mf, db } = await startD1());
});
afterAll(async () => {
  await mf.dispose();
});
beforeEach(async () => {
  await nullstill(db);
});

const env = (): Env =>
  ({ DB: db, SKJEMA_HMAC: 'h', VARSEL_TIL: 'eirik@example.no', VARSEL_FRA: 'varsel@kobberogkran.no' }) as unknown as Env;

const ny = async (opprettet: string, status: 'ny' | 'sortert' | 'varslet' | 'lukket' = 'ny') => {
  const { id } = await opprettForesporsel(db, { telefon: '+4791234567', tjeneste: 'bad', hast: 'snart' }, crypto.randomUUID());
  await db.prepare('UPDATE foresporsler SET opprettet = ? WHERE id = ?').bind(opprettet, id).run();
  if (status !== 'ny') await settStatus(db, id, status);
  return id;
};

const naa = new Date('2026-11-12T10:00:00.000Z');
const siden = (ms: number) => new Date(naa.getTime() - ms).toISOString();

describe('sveipUvarslede', () => {
  it('varsler gamle forespørsler med status ny eller sortert, og lar nye, varslede og lukkede være', async () => {
    const gammelNy = await ny(siden(SVEIP_ALDER_MS + 60_000));
    const gammelSortert = await ny(siden(SVEIP_ALDER_MS + 120_000), 'sortert');
    const fersk = await ny(siden(60_000));
    const varslet = await ny(siden(SVEIP_ALDER_MS * 3), 'varslet');
    const lukket = await ny(siden(SVEIP_ALDER_MS * 3), 'lukket');
    const send = vi.fn(async () => {});
    const antall = await sveipUvarslede(env(), {
      sorterer: new FalskSorterer({ sammendrag: 's', hast: 'snart', svarutkast: 'u' }),
      varsler: { send } as Varsler,
      naa: () => naa,
    });
    expect(antall).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
    expect((await hentForesporsel(db, gammelNy))!.status).toBe('varslet');
    expect((await hentForesporsel(db, gammelSortert))!.status).toBe('varslet');
    expect((await hentForesporsel(db, fersk))!.status).toBe('ny');
    expect((await hentForesporsel(db, varslet))!.status).toBe('varslet');
    expect((await hentForesporsel(db, lukket))!.status).toBe('lukket');
  });

  it('gir opp forespørsler eldre enn 7 dager (unngår evige forsøk)', async () => {
    await ny(siden(8 * 24 * 60 * 60 * 1000));
    const send = vi.fn(async () => {});
    expect(await sveipUvarslede(env(), { varsler: { send } as Varsler, naa: () => naa })).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('kaster ikke når databasen feiler', async () => {
    const feil = { prepare: () => { throw new Error('D1 nede'); } } as unknown as D1Database;
    await expect(sveipUvarslede({ ...env(), DB: feil }, { naa: () => naa })).resolves.toBe(0);
  });
});
