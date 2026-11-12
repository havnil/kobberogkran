// HMAC-SHA256-verifisering av webhook-kropper (WhatsApp og telefoni).
// Signaturen må gjelde de nøyaktige bytene i kroppen, så kallende kode leser kroppen én gang som
// ArrayBuffer og sender den hit uendret. `crypto.subtle.verify` sammenligner i konstant tid.

const koder = new TextEncoder();

/** Hex (store eller små bokstaver) til bytes, eller null hvis det ikke er en SHA-256-signatur. */
function hexTilBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  const ut = new Uint8Array(32);
  for (let i = 0; i < 32; i++) ut[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return ut;
}

/** true bare når `sigHex` er HMAC-SHA256 av `data` med `hemmelighet`. Kaster aldri. */
export async function verifiserHmacHex(data: ArrayBuffer, sigHex: string, hemmelighet: string): Promise<boolean> {
  if (!hemmelighet) return false;
  const sig = hexTilBytes(sigHex.trim());
  if (!sig) return false;
  try {
    const nokkel = await crypto.subtle.importKey(
      'raw',
      koder.encode(hemmelighet),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify('HMAC', nokkel, sig, data);
  } catch {
    return false;
  }
}
