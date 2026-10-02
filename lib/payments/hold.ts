/**
 * Reservation-hold planning for the moment a buyer starts paying.
 * PhonePe's Standard Checkout requires expireAfter between 300 and 3600 seconds, so a reservation that has
 * less than ~5.5 minutes left cannot be paired with a PhonePe payment window. Instead of failing with a 502,
 * we extend the buyer's own reservation (capped, so nobody can hold a ticket forever).
 */
export const PHONEPE_MIN_EXPIRY_S = 300;
export const HOLD_TARGET_S = 630;          // after extending, ~10.5 min remain
export const HOLD_MAX_TOTAL_S = 30 * 60;   // absolute cap measured from the original reservation
const SAFETY_S = 30;                       // PhonePe window always ends before our reservation does
const MIN_LEFT_TO_START_S = 10;

export type HoldPlan =
  | { ok: false }
  | { ok: true; newExpiresAtMs: number; extend: boolean; expireAfterSeconds: number };

export function planHold(p: { nowMs: number; expiresAtMs: number; reservedAtMs?: number | null }): HoldPlan {
  const remaining = (p.expiresAtMs - p.nowMs) / 1000;
  if (!(remaining > MIN_LEFT_TO_START_S)) return { ok: false };

  let newExpires = p.expiresAtMs;
  let extend = false;
  if (remaining < HOLD_TARGET_S) {
    const reservedAt = p.reservedAtMs ?? p.expiresAtMs - 15 * 60_000;
    const cap = reservedAt + HOLD_MAX_TOTAL_S * 1000;
    const target = Math.min(p.nowMs + HOLD_TARGET_S * 1000, cap);
    if (target > p.expiresAtMs) { newExpires = target; extend = true; }
  }
  const newRemaining = (newExpires - p.nowMs) / 1000;
  if (newRemaining < PHONEPE_MIN_EXPIRY_S + SAFETY_S) return { ok: false };
  return { ok: true, newExpiresAtMs: newExpires, extend, expireAfterSeconds: Math.min(900, Math.floor(newRemaining - SAFETY_S)) };
}
