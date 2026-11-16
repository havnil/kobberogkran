/**
 * Display titles (`.display`) are set large and uppercase, and Norwegian compounds such as
 * «varmtvannsberederen» can be wider than a phone column. Instead of breaking such a word, the title
 * gets the length of its longest word as `--lengste-ord`, and the CSS caps the font size so that word
 * fits the column (see `.display` in global.css).
 */
export function lengsteOrd(...tekster: (string | undefined | null)[]): number {
  const ord = tekster.flatMap((t) => (t ?? '').split(/[\s ]+/));
  return Math.max(1, ...ord.map((o) => [...o].length));
}

/** The style attribute for a display title made of the given parts. */
export function ordstil(...tekster: (string | undefined | null)[]): string {
  return `--lengste-ord: ${lengsteOrd(...tekster)}`;
}
