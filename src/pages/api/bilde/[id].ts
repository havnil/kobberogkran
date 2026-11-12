// GET /api/bilde/:id?utloper=…&sig=…: et kundebilde for Eirik, bare med gyldig og uutløpt signatur
// (se src/server/bildelenke.ts). Logikken ligger i src/server/skjema.ts.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../../../server/env';
import { haandterHentBilde } from '../../../server/skjema';

export const prerender = false;

export const GET: APIRoute = ({ request }) => haandterHentBilde(request, env as Env);
