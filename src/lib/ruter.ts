// Column count for a tile grid (`.ruter`): four columns by default, three when that fills every row
// and four would not (9 tiles: three full rows instead of 4 + 4 + 1).
export function ruterKlasse(antall: number): string | undefined {
  return antall % 3 === 0 && antall % 4 !== 0 ? 'ruter-3' : undefined;
}
