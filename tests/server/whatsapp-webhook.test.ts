import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FalskKanal } from '../../src/server/kanaler/falsk';
import type { Env } from '../../src/server/env';
import type { Varsler } from '../../src/server/varsling';

// Inngående WhatsApp skal aldri besvares automatisk. Kanalfabrikken byttes ut med falske kanaler
// som spioneres på: om webhooken noen gang begynner å sende, feiler testen.
const falske = vi.hoisted(() => ({ kanaler: [] as FalskKanal[] }));
const sendMedReserve = vi.hoisted(() => vi.fn());
vi.mock('../../src/server/kanaler/index', async (original) => ({
  ...(await original<typeof import('../../src/server/kanaler/index')>()),
  lagKanaler: () => falske.kanaler,
  sendMedReserve,
}));

const { haandterWhatsappGet, haandterWhatsappPost, verifiserMetaSignatur } = await import(
  '../../src/server/kanaler/whatsapp'
);

const HEMMELIG = 'app-hemmelighet';
const TOKEN = 'verifiser-meg';

async function signer(tekst: string, hemmelig = HEMMELIG): Promise<string> {
  const nokkel = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(hemmelig),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', nokkel, new TextEncoder().encode(tekst)));
  return 'sha256=' + [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const meldingKropp = (melding: Record<string, unknown>) =>
  JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '4700000000', phone_number_id: '123' },
              contacts: [{ profile: { name: 'Kari' }, wa_id: '4791234567' }],
              messages: [{ from: '4791234567', id: 'wamid.1', timestamp: '1700000000', ...melding }],
            },
          },
        ],
      },
    ],
  });

async function post(tekst: string, signatur?: string | null): Promise<Request> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const sig = signatur === undefined ? await signer(tekst) : signatur;
  if (sig !== null) headers['x-hub-signature-256'] = sig;
  return new Request('https://kobberogkran.no/api/whatsapp/webhook', { method: 'POST', headers, body: tekst });
}

let env: Env;
let varsler: Varsler & { send: ReturnType<typeof vi.fn> };
let ventende: Promise<unknown>[];
let kanaler: FalskKanal[];
const ctx = { waitUntil: (p: Promise<unknown>) => void ventende.push(p) };
const kjor = (req: Request) => haandterWhatsappPost(req, env, ctx, { varsler });

beforeEach(() => {
  env = {
    WHATSAPP_VERIFY_TOKEN: TOKEN,
    WHATSAPP_APP_SECRET: HEMMELIG,
    VARSEL_TIL: 'eirik@example.no',
    VARSEL_FRA: 'varsel@kobberogkran.no',
  } as unknown as Env;
  varsler = { send: vi.fn(async () => {}) };
  ventende = [];
  kanaler = [new FalskKanal('whatsapp'), new FalskKanal('rcs'), new FalskKanal('sms')];
  falske.kanaler = kanaler;
  sendMedReserve.mockClear();
});

describe('GET /api/whatsapp/webhook (verifisering)', () => {
  const url = (q: string) => new URL(`https://kobberogkran.no/api/whatsapp/webhook?${q}`);

  it('riktig token gir 200 og hub.challenge', async () => {
    const res = haandterWhatsappGet(url(`hub.mode=subscribe&hub.verify_token=${TOKEN}&hub.challenge=12345`), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('12345');
  });

  it('feil token gir 403', () => {
    expect(haandterWhatsappGet(url('hub.mode=subscribe&hub.verify_token=feil&hub.challenge=1'), env).status).toBe(403);
  });

  it('feil mode gir 403', () => {
    expect(haandterWhatsappGet(url(`hub.mode=unsubscribe&hub.verify_token=${TOKEN}&hub.challenge=1`), env).status).toBe(
      403,
    );
  });

  it('uten konfigurert token gir 403, også for tomt token', () => {
    env = { ...env, WHATSAPP_VERIFY_TOKEN: undefined };
    expect(haandterWhatsappGet(url('hub.mode=subscribe&hub.verify_token=&hub.challenge=1'), env).status).toBe(403);
  });
});

describe('POST /api/whatsapp/webhook', () => {
  it('ugyldig signatur gir 401', async () => {
    const res = await kjor(await post(meldingKropp({ type: 'text', text: { body: 'hei' } }), 'sha256=00ff'));
    expect(res.status).toBe(401);
    expect(varsler.send).not.toHaveBeenCalled();
  });

  it('signatur med feil hemmelighet gir 401', async () => {
    const tekst = meldingKropp({ type: 'text', text: { body: 'hei' } });
    expect((await kjor(await post(tekst, await signer(tekst, 'annen')))).status).toBe(401);
  });

  it('manglende signatur gir 401', async () => {
    expect((await kjor(await post(meldingKropp({ type: 'text' }), null))).status).toBe(401);
  });

  it('uten WHATSAPP_APP_SECRET avvises alt med 503', async () => {
    env = { ...env, WHATSAPP_APP_SECRET: undefined };
    expect((await kjor(await post(meldingKropp({ type: 'text' })))).status).toBe(503);
  });

  it('inngående melding varsles til Eirik og fører aldri til Kanal.send', async () => {
    const res = await kjor(await post(meldingKropp({ type: 'text', text: { body: 'Det drypper fra kranen' } })));
    expect(res.status).toBe(200);
    await Promise.all(ventende);
    expect(varsler.send).toHaveBeenCalledTimes(1);
    const [til, emne, tekst] = varsler.send.mock.calls[0];
    expect(til).toBe('eirik@example.no');
    expect(emne + tekst).toContain('+4791234567');
    expect(tekst).toContain('Det drypper fra kranen');
    expect(kanaler.every((k) => k.kall.length === 0)).toBe(true);
    expect(sendMedReserve).not.toHaveBeenCalled();
  });

  it('melding som ikke er tekst varsles med typen', async () => {
    await kjor(await post(meldingKropp({ type: 'image', image: { id: 'm1' } })));
    await Promise.all(ventende);
    expect(varsler.send.mock.calls[0][2]).toContain('image');
    expect(kanaler.every((k) => k.kall.length === 0)).toBe(true);
  });

  it('statusoppdateringer uten meldinger gir 200 og ingen varsel', async () => {
    const tekst = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: { statuses: [{ id: 'wamid.1', status: 'read' }] } }] }],
    });
    expect((await kjor(await post(tekst))).status).toBe(200);
    await Promise.all(ventende);
    expect(varsler.send).not.toHaveBeenCalled();
  });

  it('gyldig signatur men ugyldig JSON gir 400', async () => {
    expect((await kjor(await post('{ikke json'))).status).toBe(400);
  });

  it('svarer 200 selv om varselet feiler', async () => {
    varsler.send.mockRejectedValue(new Error('nede'));
    const res = await kjor(await post(meldingKropp({ type: 'text', text: { body: 'hei' } })));
    expect(res.status).toBe(200);
    await expect(Promise.all(ventende)).resolves.toBeDefined();
  });
});

describe('verifiserMetaSignatur', () => {
  it('godtar riktig signatur over de nøyaktige bytene', async () => {
    const tekst = '{"a":"æøå"}';
    const bytes = new TextEncoder().encode(tekst);
    expect(await verifiserMetaSignatur(bytes.buffer as ArrayBuffer, await signer(tekst), HEMMELIG)).toBe(true);
  });

  it('avviser header uten sha256=-prefiks', async () => {
    const tekst = '{}';
    const sig = (await signer(tekst)).slice('sha256='.length);
    expect(await verifiserMetaSignatur(new TextEncoder().encode(tekst).buffer as ArrayBuffer, sig, HEMMELIG)).toBe(
      false,
    );
  });
});
