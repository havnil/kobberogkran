// Token for skjemaet: gir kunden (og nettleseren) tilgang til steg 2 og bildeopplasting for én
// forespørsel. Tokenet er HMAC-SHA256 (hex) av `skjema:<id>` med SKJEMA_HMAC. Prefikset skiller det
// fra bildelenkene (`bilde:`), som bruker samme hemmelighet. Tokenet utløper ikke: lenken i
// kvitteringen skal virke når kunden vil sende flere bilder senere.

const koder = new TextEncoder();

const melding = (id: string) => koder.encode(`skjema:${id}`);

function nokkel(hemmelighet: string, bruk: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', koder.encode(hemmelighet), { name: 'HMAC', hash: 'SHA-256' }, false, [bruk]);
}

export async function lagSkjemaToken(id: string, hemmelighet: string): Promise<string> {
  if (!hemmelighet) throw new Error('Mangler SKJEMA_HMAC');
  const sig = await crypto.subtle.sign('HMAC', await nokkel(hemmelighet, 'sign'), melding(id));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** true bare når `token` er riktig for `id`. Konstant tid (`crypto.subtle.verify`). Kaster aldri. */
export async function verifiserSkjemaToken(id: string, token: string, hemmelighet: string): Promise<boolean> {
  if (!hemmelighet || !id || !/^[0-9a-f]{64}$/.test(token)) return false;
  const sig = new Uint8Array(32);
  for (let i = 0; i < 32; i++) sig[i] = parseInt(token.slice(i * 2, i * 2 + 2), 16);
  try {
    return await crypto.subtle.verify('HMAC', await nokkel(hemmelighet, 'verify'), sig, melding(id));
  } catch {
    return false;
  }
}
