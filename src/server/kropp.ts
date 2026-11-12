// Begrenset lesing av request-kroppen for webhooker som tar imot trafikk før signaturen er sjekket.
// Avviser for stor Content-Length straks, og slutter å lese strømmen når grensen passeres.

export const MAKS_WEBHOOK_BYTES = 64 * 1024;

/** De rå bytene, eller null når kroppen er større enn `maks`. */
export async function lesBegrensetKropp(request: Request, maks = MAKS_WEBHOOK_BYTES): Promise<ArrayBuffer | null> {
  const lengde = Number(request.headers.get('content-length'));
  if (Number.isFinite(lengde) && lengde > maks) return null;
  if (!request.body) return new ArrayBuffer(0);
  const leser = request.body.getReader();
  const biter: Uint8Array[] = [];
  let totalt = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    totalt += value.byteLength;
    if (totalt > maks) {
      await leser.cancel().catch(() => {});
      return null;
    }
    biter.push(value);
  }
  const ut = new Uint8Array(totalt);
  let pos = 0;
  for (const b of biter) {
    ut.set(b, pos);
    pos += b.byteLength;
  }
  return ut.buffer;
}

export const forStor = () => new Response('Payload Too Large', { status: 413 });
