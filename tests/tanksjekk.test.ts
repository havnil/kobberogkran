import { describe, expect, it } from 'vitest';
import { ELDSTE_AR, lesAr, maalerAndel, vurderTank } from '../src/lib/tanksjekk';

const grenser = { snartAr: 15, grenseAr: 20 };

describe('lesAr()', () => {
  it('reads four digits only', () => {
    expect(lesAr(' 2008 ')).toBe(2008);
    expect(lesAr('08')).toBeNull();
    expect(lesAr('20o8')).toBeNull();
    expect(lesAr('')).toBeNull();
  });
});

describe('vurderTank()', () => {
  it('says ok below the «plan» age', () => {
    expect(vurderTank(2020, 2026, grenser)).toEqual({ status: 'ok', alder: 6 });
  });

  it('says plan a replacement from the «plan» age', () => {
    expect(vurderTank(2011, 2026, grenser)).toEqual({ status: 'snart', alder: 15 });
    expect(vurderTank(2007, 2026, grenser)).toEqual({ status: 'snart', alder: 19 });
  });

  it('says replace now from the insurance age', () => {
    expect(vurderTank(2006, 2026, grenser)).toEqual({ status: 'naa', alder: 20 });
  });

  it('rejects missing, future and implausibly old years', () => {
    expect(vurderTank(null, 2026, grenser).status).toBe('ugyldig');
    expect(vurderTank(2027, 2026, grenser).status).toBe('ugyldig');
    expect(vurderTank(ELDSTE_AR - 1, 2026, grenser).status).toBe('ugyldig');
  });
});

describe('maalerAndel()', () => {
  it('fills the gauge in proportion and stops at the ends', () => {
    expect(maalerAndel(15, 30)).toBe(0.5);
    expect(maalerAndel(45, 30)).toBe(1);
    expect(maalerAndel(-1, 30)).toBe(0);
  });
});
