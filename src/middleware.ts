// Sikkerhetsheadere for alt Workeren svarer med (SSR-sider som takk og send-bilder, og API-et).
// De statiske sidene får de samme fra public/_headers. Headere som svaret allerede har, beholdes.
import { defineMiddleware } from 'astro:middleware';

export const SIKKERHETSHEADERE: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
};

/** Legger til headerne som mangler. Returnerer et nytt svar når headerne ikke kan endres. */
export function medSikkerhetsheadere(svar: Response): Response {
  let ut = svar;
  try {
    for (const [k, v] of Object.entries(SIKKERHETSHEADERE)) if (!ut.headers.has(k)) ut.headers.set(k, v);
  } catch {
    // Uforanderlige headere (f.eks. et svar fra fetch): kopier svaret.
    ut = new Response(svar.body, svar);
    for (const [k, v] of Object.entries(SIKKERHETSHEADERE)) if (!ut.headers.has(k)) ut.headers.set(k, v);
  }
  return ut;
}

export const onRequest = defineMiddleware(async (_ctx, next) => medSikkerhetsheadere(await next()));
