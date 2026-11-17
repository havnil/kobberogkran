// Token for skjemaet: gir kunden (og nettleseren) tilgang til steg 2 og bildeopplasting for én
// forespørsel. Tokenet er HMAC-SHA256 (hex) av `skjema:<id>` med SKJEMA_HMAC. Prefikset skiller det
// fra bildelenkene (`bilde:`), som bruker samme hemmelighet. Tokenet utløper ikke: lenken i
// kvitteringen skal virke når kunden vil sende flere bilder senere.
import { bytesTilHex, hexTilBytes, importerHmacNokkel } from './hmac';

const koder = new TextEncoder();

const melding = (id: string) => koder.encode(`skjema:${id}`);

export async function lagSkjemaToken(id: string, hemmelighet: string): Promise<string> {
  if (!hemmelighet) throw new Error('Mangler SKJEMA_HMAC');
  return bytesTilHex(await crypto.subtle.sign('HMAC', await importerHmacNokkel(hemmelighet, 'sign'), melding(id)));
}

/** true bare når `token` er riktig for `id`. Konstant tid (`crypto.subtle.verify`). Kaster aldri. */
export async function verifiserSkjemaToken(id: string, token: string, hemmelighet: string): Promise<boolean> {
  const sig = hexTilBytes(token, true);
  if (!hemmelighet || !id || !sig) return false;
  try {
    return await crypto.subtle.verify('HMAC', await importerHmacNokkel(hemmelighet, 'verify'), sig, melding(id));
  } catch {
    return false;
  }
}
