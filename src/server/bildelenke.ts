// Signerte, tidsbegrensede lenker til kundebilder i varselet til Eirik.
// Bildene sendes aldri som vedlegg. GET /api/bilde/<id> verifiserer (skjema.ts).
//
// Signaturen er HMAC-SHA256 over `bilde:<id>:<utloper>`. Prefikset skiller bruken fra andre
// HMAC-er med samme hemmelighet (SKJEMA_HMAC).
import { bytesTilHex, hexTilBytes, importerHmacNokkel } from './hmac';

const koder = new TextEncoder();

function melding(bildeId: string, utloperEpochSek: number): Uint8Array<ArrayBuffer> {
  return koder.encode(`bilde:${bildeId}:${utloperEpochSek}`);
}

/** Sti (uten vert) som `/api/bilde/<bildeId>?utloper=<ts>&sig=<hex>`. */
export async function signerBildeLenke(bildeId: string, hmacHemmelighet: string, utloperEpochSek: number): Promise<string> {
  if (!hmacHemmelighet) throw new Error('Mangler HMAC-hemmelighet');
  const sig = await crypto.subtle.sign('HMAC', await importerHmacNokkel(hmacHemmelighet, 'sign'), melding(bildeId, utloperEpochSek));
  return `/api/bilde/${encodeURIComponent(bildeId)}?utloper=${utloperEpochSek}&sig=${bytesTilHex(sig)}`;
}

/**
 * true bare når signaturen stemmer og lenken ikke er utløpt. Kaster aldri.
 * `crypto.subtle.verify` sammenligner i konstant tid.
 */
export async function verifiserBildeLenke(
  bildeId: string,
  utloperEpochSek: number,
  sigHex: string,
  hmacHemmelighet: string,
  naaEpochSek: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!hmacHemmelighet || !Number.isSafeInteger(utloperEpochSek) || utloperEpochSek <= naaEpochSek) return false;
  const sig = hexTilBytes(sigHex, true);
  if (!sig) return false;
  try {
    return await crypto.subtle.verify('HMAC', await importerHmacNokkel(hmacHemmelighet, 'verify'), sig, melding(bildeId, utloperEpochSek));
  } catch {
    return false;
  }
}
