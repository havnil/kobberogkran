// GET/POST /api/whatsapp/webhook: Metas verifisering og inngående WhatsApp-meldinger.
// Logikken ligger i src/server/kanaler/whatsapp.ts. Inngående meldinger varsles til Eirik og
// besvares aldri automatisk.
//
// Astro 7 + @astrojs/cloudflare 14: bindinger og hemmeligheter hentes med
// `import { env } from 'cloudflare:workers'`, og ExecutionContext (for `waitUntil`) ligger i
// `locals.cfContext` (se node_modules/@astrojs/cloudflare/dist/utils/handler.js og cf-helpers.d.ts).
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../../../server/env';
import { haandterWhatsappGet, haandterWhatsappPost } from '../../../server/kanaler/whatsapp';

export const prerender = false;

export const GET: APIRoute = ({ url }) => haandterWhatsappGet(url, env as Env);

export const POST: APIRoute = ({ request, locals }) =>
  haandterWhatsappPost(request, env as Env, locals.cfContext);
