import { describe, expect, it } from 'vitest';
import { synligeOmtale, visEksempler } from '../src/lib/omtale';

const alle = [
  { type: 'anmeldelse', tekst: 'a', ekte: false },
  { type: 'godkjenning', tekst: 'b', ekte: true },
] as const;

describe('visEksempler', () => {
  it('shows examples in dev and in a normal production build', () => {
    expect(visEksempler(false, undefined)).toBe(true);
    expect(visEksempler(false, 'true')).toBe(true);
    expect(visEksempler(true, undefined)).toBe(true);
    expect(visEksempler(true, '')).toBe(true);
    expect(visEksempler(true, 'false')).toBe(true);
  });

  it('hides examples in a production build with LAUNCH set', () => {
    expect(visEksempler(true, 'true')).toBe(false);
  });
});

describe('synligeOmtale', () => {
  it('keeps real entries always and examples only when allowed', () => {
    expect(synligeOmtale([...alle], true)).toHaveLength(2);
    expect(synligeOmtale([...alle], false).map((o) => o.tekst)).toEqual(['b']);
  });
});
