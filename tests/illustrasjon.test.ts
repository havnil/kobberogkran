import { describe, expect, it } from 'vitest';
import { GENERISK_PLASSHOLDER, tjenesteBilde } from '../src/lib/illustrasjon';

describe('tjenesteBilde', () => {
  it('uses a real image when there is one', () => {
    const bilder = [
      { src: '/images/uploads/a.jpg', plassholder: true },
      { src: '/images/uploads/ekte.jpg', plassholder: false },
    ];
    expect(tjenesteBilde({ translationKey: 'bad', bilder })).toEqual({ src: '/images/uploads/ekte.jpg', plassholder: false });
  });

  it('falls back to the drawn illustration for the generic placeholder', () => {
    const bilder = [{ src: GENERISK_PLASSHOLDER, plassholder: true }];
    expect(tjenesteBilde({ translationKey: 'hytte', bilder })).toEqual({
      src: '/images/uploads/illustrasjon-hytte.svg',
      plassholder: true,
    });
    expect(tjenesteBilde({ translationKey: 'hytte', bilder: [] }).src).toBe('/images/uploads/illustrasjon-hytte.svg');
  });

  it('keeps a specific placeholder image, still marked as placeholder', () => {
    const bilder = [{ src: '/images/uploads/plassholder-hytte-snoe.jpg', plassholder: true }];
    expect(tjenesteBilde({ translationKey: 'hytte', bilder })).toEqual({
      src: '/images/uploads/plassholder-hytte-snoe.jpg',
      plassholder: true,
    });
  });
});
