// Phone helpers shared by Header and MobilBunnlinje. Plain TypeScript (no Astro imports).

/** `tel:` link: keeps a leading `+`, drops spaces and other characters. */
export function telHref(verdi: string): string {
  return `tel:${verdi.replace(/[^\d+]/g, '')}`;
}

/** Digits only, as `https://wa.me/<digits>` requires (no `+`). */
export function waDigits(verdi: string): string {
  return verdi.replace(/\D/g, '');
}
