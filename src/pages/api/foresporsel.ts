// POST /api/foresporsel: steg 1 i skjemaet. Logikken ligger i src/server/skjema.ts.
// Bindinger fra `cloudflare:workers`, waitUntil fra `locals.cfContext` (Astro 7 + @astrojs/cloudflare 14).
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../../server/env';
import { haandterSteg1 } from '../../server/skjema';

export const prerender = false;

export const POST: APIRoute = ({ request, locals }) => haandterSteg1(request, env as Env, locals.cfContext);
