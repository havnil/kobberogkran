// Which image a service shows. A real image (`plassholder: false`) wins. Otherwise the placeholder
// image is used when it points at a real file; the generic `plassholder.jpg` (which does not exist)
// falls back to the service's drawn illustration, `illustrasjon-<translationKey>.svg`.
export const GENERISK_PLASSHOLDER = '/images/uploads/plassholder.jpg';

export interface Bilde {
  src: string;
  plassholder: boolean;
}

export function illustrasjonFor(translationKey: string): string {
  return `/images/uploads/illustrasjon-${translationKey}.svg`;
}

export function tjenesteBilde(tjeneste: { translationKey: string; bilder: Bilde[] }): Bilde {
  const ekte = tjeneste.bilder.find((b) => !b.plassholder && b.src.trim() !== '');
  if (ekte) return { src: ekte.src, plassholder: false };
  const utkast = tjeneste.bilder.find((b) => b.src.trim() !== '' && b.src !== GENERISK_PLASSHOLDER);
  return { src: utkast?.src ?? illustrasjonFor(tjeneste.translationKey), plassholder: true };
}
