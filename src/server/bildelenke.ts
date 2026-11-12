// Signerte, tidsbegrensede lenker til kundebilder i varselet til Eirik.
// Bildene sendes aldri som vedlegg. Oppgave 7 legger til GET /api/bilde/<id> som verifiserer.
//
// Signaturen er HMAC-SHA256 over `bilde:<id>:<utloper>`. Prefikset skiller bruken fra andre
// HMAC-er med samme hemmelighet (SKJEMA_HMAC).

const koder = new TextEncoder();

function melding(bildeId: string, utloperEpochSek: number): Uint8Array<ArrayBuffer> {
  return koder.encode(`bilde:${bildeId}:${utloperEpochSek}`);
}

function nokkel(hemmelighet: string, bruk: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', koder.encode(hemmelighet), { name: 'HMAC', hash: 'SHA-256' }, false, [bruk]);
}

const tilHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Sti (uten vert) som `/api/bilde/<bildeId>?utloper=<ts>&sig=<hex>`. */
export async function signerBildeLenke(bildeId: string, hmacHemmelighet: string, utloperEpochSek: number): Promise<string> {
  if (!hmacHemmelighet) throw new Error('Mangler HMAC-hemmelighet');
  const sig = await crypto.subtle.sign('HMAC', await nokkel(hmacHemmelighet, 'sign'), melding(bildeId, utloperEpochSek));
  return `/api/bilde/${encodeURIComponent(bildeId)}?utloper=${utloperEpochSek}&sig=${tilHex(sig)}`;
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
  if (!/^[0-9a-f]{64}$/.test(sigHex)) return false;
  const sig = new Uint8Array(32);
  for (let i = 0; i < 32; i++) sig[i] = parseInt(sigHex.slice(i * 2, i * 2 + 2), 16);
  try {
    return await crypto.subtle.verify('HMAC', await nokkel(hmacHemmelighet, 'verify'), sig, melding(bildeId, utloperEpochSek));
  } catch {
    return false;
  }
}
