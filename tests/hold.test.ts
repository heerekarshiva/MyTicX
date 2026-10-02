import { describe, it, expect } from 'vitest';
import { planHold, PHONEPE_MIN_EXPIRY_S } from '@/lib/payments/hold';

const now = 1_700_000_000_000;
const min = (n: number) => n * 60_000;

describe('planHold', () => {
  it('fresh reservation: no extension, 15 min window capped at 900s', () => {
    const r = planHold({ nowMs: now, expiresAtMs: now + min(15), reservedAtMs: now });
    expect(r).toMatchObject({ ok: true, extend: false, expireAfterSeconds: 870 });
  });
  it('3 min left: extends so PhonePe minimum (300s) is satisfied', () => {
    const r = planHold({ nowMs: now, expiresAtMs: now + min(3), reservedAtMs: now - min(12) });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.extend).toBe(true); expect(r.expireAfterSeconds).toBeGreaterThanOrEqual(PHONEPE_MIN_EXPIRY_S); expect(r.newExpiresAtMs).toBeGreaterThan(now + min(3)); }
  });
  it('already expired or about to: refuses', () => {
    expect(planHold({ nowMs: now, expiresAtMs: now - 1000 }).ok).toBe(false);
    expect(planHold({ nowMs: now, expiresAtMs: now + 5000 }).ok).toBe(false);
  });
  it('hold cap: cannot extend past 30 min from the original reservation', () => {
    const r = planHold({ nowMs: now, expiresAtMs: now + min(2), reservedAtMs: now - min(28) });
    expect(r.ok).toBe(false);
  });
  it('never returns an expireAfter below 300s', () => {
    for (let s = 11; s < 1000; s += 7) {
      const r = planHold({ nowMs: now, expiresAtMs: now + s * 1000, reservedAtMs: now - 5 * 60_000 });
      if (r.ok) expect(r.expireAfterSeconds).toBeGreaterThanOrEqual(PHONEPE_MIN_EXPIRY_S);
    }
  });
});
