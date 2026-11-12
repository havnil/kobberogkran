// Felles oppsett for tester som trenger en D1-database (Miniflare, i vanlig Vitest).
import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import type { D1Database } from '@cloudflare/workers-types';

const migrering = readFileSync(new URL('../../migrations/0001_init.sql', import.meta.url), 'utf8');

export async function startD1(): Promise<{ mf: Miniflare; db: D1Database }> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'test-db' },
  });
  const db = (await mf.getD1Database('DB')) as unknown as D1Database;
  return { mf, db };
}

/** Sletter alle tabeller og kjører migreringen på nytt. */
export async function nullstill(db: D1Database): Promise<void> {
  for (const t of ['hendelser', 'samtykker', 'bilder', 'foresporsler', 'kunder']) {
    await db.exec(`DROP TABLE IF EXISTS ${t}`);
  }
  const uten = migrering.replace(/^--.*$/gm, '');
  const stmts = uten.split(';').map((s) => s.trim()).filter(Boolean);
  await db.batch(stmts.map((s) => db.prepare(s)));
}
