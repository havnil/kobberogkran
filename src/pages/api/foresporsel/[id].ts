// PATCH /api/foresporsel/:id: steg 2 i skjemaet, med `Authorization: Bearer <token>`.
// Logikken ligger i src/server/skjema.ts.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../../../server/env';
import { haandterSteg2 } from '../../../server/skjema';

export const prerender = false;

export const PATCH: APIRoute = ({ request, params, locals }) =>
  haandterSteg2(request, env as Env, locals.cfContext, params.id ?? '');
