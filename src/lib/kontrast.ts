// Kontrastforhold etter WCAG 2.1 (relativ luminans). Ren funksjon; brukes av testen for fargene.

function luminans(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Ugyldig farge: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrastforholdet mellom to farger (#RRGGBB), fra 1 til 21. */
export function kontrast(a: string, b: string): number {
  const [x, y] = [luminans(a), luminans(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
