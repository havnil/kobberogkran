import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:middleware', () => ({ defineMiddleware: (f: unknown) => f }));
const { medSikkerhetsheadere, SIKKERHETSHEADERE } = await import('../src/middleware');

describe('sikkerhetsheadere', () => {
  it('legger til headerne på SSR-svar, og beholder dem som finnes', () => {
    const svar = medSikkerhetsheadere(new Response('x', { headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } }));
    expect(svar.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(svar.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'");
    expect(svar.headers.get('Permissions-Policy')).toBe('geolocation=(self), camera=(), microphone=()');
  });

  it('virker også når headerne er uforanderlige', () => {
    const r = Response.redirect('https://kobberogkran.no/', 303);
    const svar = medSikkerhetsheadere(r);
    expect(svar.status).toBe(303);
    expect(svar.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('public/_headers har de samme headerne for alle statiske sider', () => {
    const fil = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
    expect(fil).toMatch(/^\/\*$/m);
    for (const [k, v] of Object.entries(SIKKERHETSHEADERE)) expect(fil).toContain(`  ${k}: ${v}`);
  });
});
