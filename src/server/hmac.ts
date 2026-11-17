// Felles HMAC-SHA256-hjelpere: webhook-signaturer (WhatsApp og telefoni), skjematokenet (token.ts)
// og bildelenkene (bildelenke.ts). `crypto.subtle.verify` sammenligner i konstant tid.

const koder = new TextEncoder();

/** HMAC-SHA256-nøkkel fra en hemmelighet (tekst). */
export function importerHmacNokkel(hemmelighet: string, bruk: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', koder.encode(hemmelighet), { name: 'HMAC', hash: 'SHA-256' }, false, [bruk]);
}

/** 64 hex-tegn (store eller små bokstaver) til 32 bytes, eller null hvis det ikke er en SHA-256-verdi. */
export function hexTilBytes(hex: string, bareSmaa = false): Uint8Array<ArrayBuffer> | null {
  if (!(bareSmaa ? /^[0-9a-f]{64}$/ : /^[0-9a-fA-F]{64}$/).test(hex)) return null;
  const ut = new Uint8Array(32);
  for (let i = 0; i < 32; i++) ut[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return ut;
}

/** Bytes til hex med små bokstaver. */
export function bytesTilHex(b: ArrayBuffer | Uint8Array): string {
  return [...(b instanceof Uint8Array ? b : new Uint8Array(b))].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * true bare når `sigHex` er HMAC-SHA256 av `data` med `hemmelighet`. Kaster aldri.
 * Signaturen må gjelde de nøyaktige bytene i kroppen, så kallende kode leser kroppen én gang som
 * ArrayBuffer og sender den hit uendret.
 */
export async function verifiserHmacHex(data: ArrayBuffer, sigHex: string, hemmelighet: string): Promise<boolean> {
  if (!hemmelighet) return false;
  const sig = hexTilBytes(sigHex.trim());
  if (!sig) return false;
  try {
    return await crypto.subtle.verify('HMAC', await importerHmacNokkel(hemmelighet, 'verify'), sig, data);
  } catch {
    return false;
  }
}
