// Adds `?kilde=<tag>` from the page URL to every WhatsApp link's greeting. No storage, no cookies, no third parties.
import { fyllHilsen, renKilde, waLenke } from '../lib/whatsapp';

const kilde = renKilde(new URLSearchParams(location.search).get('kilde'));
if (kilde) {
  document.querySelectorAll<HTMLAnchorElement>('a[data-wa]').forEach((a) => {
    const { waNummer, waMal, waTjeneste } = a.dataset;
    if (waNummer && waMal) a.href = waLenke(waNummer, fyllHilsen(waMal, { tjeneste: waTjeneste, kilde }));
  });
}
