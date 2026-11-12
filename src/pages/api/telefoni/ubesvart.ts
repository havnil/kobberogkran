// POST /api/telefoni/ubesvart: telefonitjenesten melder et ubesvart anrop. Logikken ligger i
// src/server/telefoni.ts; denne filen henter bare env og waitUntil.
//
// Astro 7 + @astrojs/cloudflare 14: `Astro.locals.runtime` er fjernet. Bindinger og hemmeligheter
// hentes med `import { env } from 'cloudflare:workers'`, og ExecutionContext (for `waitUntil`)
// ligger i `locals.cfContext` (se node_modules/@astrojs/cloudflare/dist/utils/handler.js og cf-helpers.d.ts).
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../../../server/env';
import { haandterUbesvartAnrop } from '../../../server/telefoni';

export const prerender = false;

export const POST: APIRoute = ({ request, locals }) =>
  haandterUbesvartAnrop(request, env as Env, locals.cfContext);
