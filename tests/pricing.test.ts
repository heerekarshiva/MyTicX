import { describe, it, expect } from 'vitest';
import { suggestResalePrice, getResalePriceBounds, calculatePlatformFee } from '@/lib/config/pricing';

describe('pricing rules', () => {
  it('caps resale price at least ₹50 below original', () => {
    const { max } = getResalePriceBounds(300);
    expect(max).toBeLessThanOrEqual(250);
  });

  it('keeps the recommendation within the allowed band', () => {
    const s = suggestResalePrice({ originalPrice: 350, hoursUntilShow: 10, activeResaleListingsForShow: 1 });
    expect(s.recommended).toBeGreaterThanOrEqual(s.min);
    expect(s.recommended).toBeLessThanOrEqual(s.max);
  });

  it('platform fee stays within the ₹10–15 band', () => {
    const fee = calculatePlatformFee(300);
    expect(fee).toBeGreaterThanOrEqual(10);
    expect(fee).toBeLessThanOrEqual(15);
  });
});
