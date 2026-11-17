// POST /api/bilde?id=…&token=…: bildeopplasting (rå image/* eller multipart med feltet `bilde`).
// Logikken ligger i src/server/skjema.ts.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../../server/env';
import { haandterBildeOpplasting } from '../../server/skjema';

export const prerender = false;

export const POST: APIRoute = ({ request, locals }) => haandterBildeOpplasting(request, env as Env, locals.cfContext);
