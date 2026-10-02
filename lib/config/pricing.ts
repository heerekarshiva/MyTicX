// Centralized, config-driven pricing rules. Nothing here is hard-coded into
// individual pages — every screen that needs a price computes it by calling
// these functions so the business rule lives in exactly one place.

export const PRICING_CONFIG = {
  // Flat-discount rule: resale price must be at least ₹50 below the
  // original ticket price. (The 80–95% band is kept as a sanity ceiling so
  // a very cheap ticket can't be listed at a token ₹1 discount-adjacent
  // price that undercuts the flat rule in an unreasonable way.)
  minFlatDiscount: 50,
  minResalePct: 0.80,
  maxResalePct: 0.95,
  platformFeeMin: 10,
  platformFeeMax: 15,
  platformFeeDefault: 12
};

export function getResalePriceBounds(originalPrice: number) {
  const byFlatDiscount = originalPrice - PRICING_CONFIG.minFlatDiscount;
  const byPct = originalPrice * PRICING_CONFIG.maxResalePct;
  const max = round2(Math.max(0, Math.min(byFlatDiscount, byPct)));
  const min = round2(originalPrice * PRICING_CONFIG.minResalePct);
  return { min: Math.min(min, max), max };
}


export interface PriceSuggestionInput {
  originalPrice: number;
  hoursUntilShow: number;
  activeResaleListingsForShow: number;
  moviePopularityScore?: number;
}

export interface PriceSuggestion {
  min: number;
  max: number;
  recommended: number;
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
}

export function suggestResalePrice(input: PriceSuggestionInput): PriceSuggestion {
  const { originalPrice, hoursUntilShow, activeResaleListingsForShow, moviePopularityScore } = input;
  const { min, max } = getResalePriceBounds(originalPrice);

  let position = 0.5;
  if (hoursUntilShow < 3) position -= 0.15;
  else if (hoursUntilShow > 48) position += 0.1;

  if (activeResaleListingsForShow >= 5) position -= 0.1;
  else if (activeResaleListingsForShow === 0) position += 0.1;

  if (typeof moviePopularityScore === 'number') {
    position += (moviePopularityScore - 0.5) * 0.15;
  }

  position = clamp(position, 0, 1);
  const recommended = round2(min + (max - min) * position);
  const hasEnoughSignal = activeResaleListingsForShow > 0 || typeof moviePopularityScore === 'number';

  return {
    min,
    max,
    recommended,
    confidence: hasEnoughSignal ? 'medium' : 'low',
    explanation: hasEnoughSignal
      ? `Suggested price based on current demand — must be at least ₹${PRICING_CONFIG.minFlatDiscount} below the original ₹${originalPrice.toFixed(0)}.`
      : `Limited marketplace data yet. Price must be at least ₹${PRICING_CONFIG.minFlatDiscount} below the original ticket price.`
  };
}

export function calculatePlatformFee(resalePrice: number): number {
  // Flat fee within the ₹10–15 platform range. Kept as a function (rather
  // than inlined) so a tiered/percentage model can replace it later.
  return PRICING_CONFIG.platformFeeDefault;
}

export function calculateBuyerTotal(resalePrice: number, platformFee: number): number {
  return round2(resalePrice + platformFee);
}

function round2(n: number) { return Math.round(n * 100) / 100; }
function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)); }
